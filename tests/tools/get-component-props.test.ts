import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getComponentProps } from '../../src/tools/get-component-props.js';

let tmp: string;

function write(rel: string, content = '') {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
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

  it('flags imported type as unresolved with a helpful note', () => {
    write('src/types.ts', 'export interface Shared { x: number }');
    write(
      'src/Uses.tsx',
      `import type { Shared } from './types';
export function Uses(props: Shared) { return null; }`
    );
    const r = getComponentProps(tmp, 'Uses', 'src/Uses.tsx');
    expect(r.found).toBe(true);
    expect(r.propsTypeSource).toBe('imported');
    expect(r.propsTypeName).toBe('Shared');
    expect(r.props).toEqual([]);
    expect(r.notes[0]).toMatch(/imported from another module/);
  });

  it('flags intersection types as unresolved', () => {
    write(
      'src/X.tsx',
      `type A = { a: string };
type B = { b: number };
type Props = A & B;
export function X(props: Props) { return null; }`
    );
    const r = getComponentProps(tmp, 'X', 'src/X.tsx');
    expect(r.propsTypeSource).toBe('unresolved');
    expect(r.notes[0]).toMatch(/intersection or mapped type/);
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
