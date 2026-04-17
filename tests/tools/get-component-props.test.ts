import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getComponentProps } from '../../src/tools/get-component-props.js';
import { clearAstCache } from '../../src/tools/shared/ast-cache.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  clearAstCache();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('getComponentProps', () => {
  it('extracts props from inline object type', () => {
    write(
      'src/Button.tsx',
      `export function Button(props: { label: string; onClick?: () => void }) {
  return null;
}`
    );
    const r = getComponentProps(tmp, 'Button', 'src/Button.tsx');
    expect(r.found).toBe(true);
    expect(r.componentKind).toBe('function');
    expect(r.propsTypeSource).toBe('inline');
    expect(r.props).toEqual([
      { name: 'label', type: 'string', required: true },
      { name: 'onClick', type: '() => void', required: false },
    ]);
  });

  it('extracts props from local interface', () => {
    write(
      'src/Button.tsx',
      `interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}
export function Button(props: ButtonProps) { return null; }`
    );
    const r = getComponentProps(tmp, 'Button', 'src/Button.tsx');
    expect(r.propsTypeSource).toBe('local-interface');
    expect(r.propsTypeName).toBe('ButtonProps');
    expect(r.props.map((p) => p.name)).toEqual(['label', 'variant', 'onClick']);
    expect(r.props.find((p) => p.name === 'variant')?.type).toBe(
      "'primary' | 'secondary'"
    );
    expect(r.props.find((p) => p.name === 'variant')?.required).toBe(false);
    expect(r.props.find((p) => p.name === 'onClick')?.required).toBe(true);
  });

  it('extracts props from local type alias', () => {
    write(
      'src/Modal.tsx',
      `type ModalProps = { open: boolean; title?: string };
export function Modal(props: ModalProps) { return null; }`
    );
    const r = getComponentProps(tmp, 'Modal', 'src/Modal.tsx');
    expect(r.propsTypeSource).toBe('local-type');
    expect(r.props).toEqual([
      { name: 'open', type: 'boolean', required: true },
      { name: 'title', type: 'string', required: false },
    ]);
  });

  it('handles destructured param with type reference', () => {
    write(
      'src/Card.tsx',
      `interface Props { title: string; footer?: string }
export function Card({ title, footer }: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'Card', 'src/Card.tsx');
    expect(r.props.map((p) => p.name)).toEqual(['title', 'footer']);
  });

  it('handles arrow function components', () => {
    write(
      'src/Toast.tsx',
      `type Props = { message: string };
export const Toast = (props: Props) => null;`
    );
    const r = getComponentProps(tmp, 'Toast', 'src/Toast.tsx');
    expect(r.componentKind).toBe('arrow');
    expect(r.props).toEqual([{ name: 'message', type: 'string', required: true }]);
  });

  it('handles export default function components', () => {
    write(
      'src/Page.tsx',
      `interface Props { slug: string }
export default function Page(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'Page', 'src/Page.tsx');
    expect(r.found).toBe(true);
    expect(r.props).toEqual([{ name: 'slug', type: 'string', required: true }]);
  });

  it('resolves imported interface one hop', () => {
    write(
      'src/types.ts',
      `export interface Shared { id: string; label?: string }`
    );
    write(
      'src/Uses.tsx',
      `import type { Shared } from './types';
export function Uses(props: Shared) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.found).toBe(true);
    expect(r.propsTypeSource).toBe('imported-interface');
    expect(r.propsTypeName).toBe('Shared');
    expect(r.propsTypeFile).toBe('src/types.ts');
    expect(r.props).toEqual([
      { name: 'id', type: 'string', required: true },
      { name: 'label', type: 'string', required: false },
    ]);
  });

  it('resolves imported type alias one hop', () => {
    write(
      'src/types.ts',
      `export type Shared = { id: string; count?: number };`
    );
    write(
      'src/Uses.tsx',
      `import type { Shared } from './types';
export function Uses(props: Shared) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.propsTypeSource).toBe('imported-type');
    expect(r.propsTypeFile).toBe('src/types.ts');
    expect(r.props).toEqual([
      { name: 'id', type: 'string', required: true },
      { name: 'count', type: 'number', required: false },
    ]);
  });

  it('resolves imported type via tsconfig alias', () => {
    write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } })
    );
    write('src/types/user.ts', 'export interface User { id: string }');
    write(
      'src/Uses.tsx',
      `import type { User } from '@/types/user';
export function Uses(props: User) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.propsTypeSource).toBe('imported-interface');
    expect(r.propsTypeFile).toBe('src/types/user.ts');
    expect(r.props[0].name).toBe('id');
  });

  it('handles renamed imports (import { A as B })', () => {
    write('src/types.ts', 'export interface Original { x: number }');
    write(
      'src/Uses.tsx',
      `import type { Original as Renamed } from './types';
export function Uses(props: Renamed) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.propsTypeSource).toBe('imported-interface');
    expect(r.propsTypeName).toBe('Original'); // exported name, not local alias
    expect(r.props).toEqual([{ name: 'x', type: 'number', required: true }]);
  });

  it('flags unresolvable imports with a helpful note', () => {
    write(
      'src/Uses.tsx',
      `import type { Missing } from './does-not-exist';
export function Uses(props: Missing) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.propsTypeSource).toBe('imported-unresolved');
    expect(r.props).toEqual([]);
    expect(r.notes[0]).toMatch(/could not be resolved/);
  });

  it('extracts props from class component with React.Component<Props>', () => {
    write(
      'src/Classy.tsx',
      `import React from 'react';
interface Props { title: string; count?: number }
export class Classy extends React.Component<Props> {
  render() { return null; }
}`
    );
    const r = getComponentProps(tmp, 'Classy', 'src/Classy.tsx');
    expect(r.found).toBe(true);
    expect(r.componentKind).toBe('class');
    expect(r.propsTypeSource).toBe('local-interface');
    expect(r.props).toEqual([
      { name: 'title', type: 'string', required: true },
      { name: 'count', type: 'number', required: false },
    ]);
  });

  it('extracts props from class component with bare Component<Props>', () => {
    write(
      'src/Classy.tsx',
      `import { Component } from 'react';
type Props = { open: boolean };
export class Classy extends Component<Props> {
  render() { return null; }
}`
    );
    const r = getComponentProps(tmp, 'Classy', 'src/Classy.tsx');
    expect(r.componentKind).toBe('class');
    expect(r.propsTypeSource).toBe('local-type');
    expect(r.props).toEqual([{ name: 'open', type: 'boolean', required: true }]);
  });

  it('handles class component with imported Props interface', () => {
    write('src/types.ts', 'export interface ClassyProps { label: string }');
    write(
      'src/Classy.tsx',
      `import React from 'react';
import type { ClassyProps } from './types';
export class Classy extends React.Component<ClassyProps> {
  render() { return null; }
}`
    );
    const r = getComponentProps(tmp, 'Classy', 'src/Classy.tsx');
    expect(r.componentKind).toBe('class');
    expect(r.propsTypeSource).toBe('imported-interface');
    expect(r.propsTypeFile).toBe('src/types.ts');
    expect(r.props).toEqual([{ name: 'label', type: 'string', required: true }]);
  });

  it('reports class component without props type argument', () => {
    write(
      'src/Classy.tsx',
      `import React from 'react';
export class Classy extends React.Component {
  render() { return null; }
}`
    );
    const r = getComponentProps(tmp, 'Classy', 'src/Classy.tsx');
    expect(r.componentKind).toBe('class');
    expect(r.propsTypeSource).toBeNull();
    expect(r.notes[0]).toMatch(/no props type argument/);
  });

  it('resolves intersection types via a named alias', () => {
    write(
      'src/X.tsx',
      `type A = { a: string };
type B = { b: number };
type Props = A & B;
export function X(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('local-type');
    expect(r.propsTypeName).toBe('Props');
    expect(r.props).toEqual([
      { name: 'a', type: 'string', required: true },
      { name: 'b', type: 'number', required: true },
    ]);
  });

  it('resolves top-level intersection (unnamed composition)', () => {
    write(
      'src/X.tsx',
      `type A = { a: string };
type B = { b?: number };
export function X(props: A & B) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.propsTypeName).toBeNull();
    expect(r.props).toEqual([
      { name: 'a', type: 'string', required: true },
      { name: 'b', type: 'number', required: false },
    ]);
  });

  it('later intersection branch overrides earlier on name conflict', () => {
    write(
      'src/X.tsx',
      `type A = { label: string };
type B = { label: number };
export function X(props: A & B) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.props).toEqual([{ name: 'label', type: 'number', required: true }]);
  });

  it('resolves interface extends (single base)', () => {
    write(
      'src/X.tsx',
      `interface Base { id: string }
interface Props extends Base { label: string }
export function X(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('local-interface');
    expect(r.propsTypeName).toBe('Props');
    expect(r.props).toEqual([
      { name: 'id', type: 'string', required: true },
      { name: 'label', type: 'string', required: true },
    ]);
  });

  it('resolves interface extends (multiple bases, own wins)', () => {
    write(
      'src/X.tsx',
      `interface A { x: string; y: number }
interface B { y: string; z: boolean }
interface Props extends A, B { z: string }
export function X(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('local-interface');
    // A contributes x, y; B overrides y and adds z; Props overrides z.
    expect(r.props).toEqual([
      { name: 'x', type: 'string', required: true },
      { name: 'y', type: 'string', required: true },
      { name: 'z', type: 'string', required: true },
    ]);
  });

  it('resolves Omit<Base, K>', () => {
    write(
      'src/X.tsx',
      `interface Base { a: string; b: number; c: boolean }
export function X(props: Omit<Base, 'b'>) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.propsTypeName).toBe('Omit');
    expect(r.props.map((p) => p.name)).toEqual(['a', 'c']);
  });

  it('resolves Pick<Base, K | K2>', () => {
    write(
      'src/X.tsx',
      `interface Base { a: string; b: number; c: boolean }
export function X(props: Pick<Base, 'a' | 'c'>) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.props.map((p) => p.name)).toEqual(['a', 'c']);
  });

  it('resolves Partial<Base>', () => {
    write(
      'src/X.tsx',
      `interface Base { a: string; b: number }
export function X(props: Partial<Base>) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.props).toEqual([
      { name: 'a', type: 'string', required: false },
      { name: 'b', type: 'number', required: false },
    ]);
  });

  it('resolves Required<Base>', () => {
    write(
      'src/X.tsx',
      `interface Base { a?: string; b?: number }
export function X(props: Required<Base>) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.props).toEqual([
      { name: 'a', type: 'string', required: true },
      { name: 'b', type: 'number', required: true },
    ]);
  });

  it('resolves React.FC<Props> generic on a const', () => {
    write(
      'src/Btn.tsx',
      `import React from 'react';
interface Props { label: string; onClick?: () => void }
export const Btn: React.FC<Props> = (props) => null;`
    );
    const r = getComponentProps(tmp, 'Btn', 'src/Btn.tsx');
    expect(r.found).toBe(true);
    expect(r.propsTypeSource).toBe('local-interface');
    expect(r.propsTypeName).toBe('Props');
    expect(r.props.map((p) => p.name)).toEqual(['label', 'onClick']);
  });

  it('resolves bare FC<Props> (named import)', () => {
    write(
      'src/Btn.tsx',
      `import { FC } from 'react';
type Props = { label: string };
export const Btn: FC<Props> = (props) => null;`
    );
    const r = getComponentProps(tmp, 'Btn', 'src/Btn.tsx');
    expect(r.propsTypeSource).toBe('local-type');
    expect(r.props).toEqual([{ name: 'label', type: 'string', required: true }]);
  });

  it('resolves intersection of imported + local type', () => {
    write('src/types.ts', 'export interface Base { id: string }');
    write(
      'src/X.tsx',
      `import type { Base } from './types';
type Local = { label: string };
export function X(props: Base & Local) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('composed');
    expect(r.props.map((p) => p.name)).toEqual(['id', 'label']);
  });

  it('reports unsupported top-level types with a note', () => {
    write(
      'src/X.tsx',
      `type Props = { [K in 'a' | 'b']: string };
export function X(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    // Mapped type is inside a local-type alias; the reference classifies as
    // local-type but the resolver can't extract members and adds a note.
    expect(r.propsTypeSource).toBe('local-type');
    expect(r.props).toEqual([]);
    expect(r.notes.some((n) => /TSMappedType|Unsupported/.test(n))).toBe(true);
  });

  it('reports not-found when the component is missing', () => {
    write('src/Foo.tsx', 'export function Bar() { return null; }');
    const r = getComponentProps(tmp, 'Foo', 'src/Foo.tsx');
    expect(r.found).toBe(false);
    expect(r.notes[0]).toMatch(/not found/);
  });

  it('handles components with no params', () => {
    write('src/Empty.tsx', 'export function Empty() { return null; }');
    const r = getComponentProps(tmp, 'Empty', 'src/Empty.tsx');
    expect(r.found).toBe(true);
    expect(r.props).toEqual([]);
    expect(r.notes[0]).toBe('Component takes no parameter');
  });

  it('handles components without prop type annotation', () => {
    write('src/Loose.jsx', 'export function Loose(props) { return null; }');
    const r = getComponentProps(tmp, 'Loose', 'src/Loose.jsx');
    expect(r.found).toBe(true);
    expect(r.props).toEqual([]);
    expect(r.notes[0]).toMatch(/no type annotation/);
  });

  it('throws when the file does not exist', () => {
    expect(() => getComponentProps(tmp, 'X', 'nope.ts')).toThrow(/File not found/);
  });
});
