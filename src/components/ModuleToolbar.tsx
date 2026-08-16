// components/ModuleToolbar.tsx
import styles from "../App.module.scss";

export type ModuleButtonConfig = {
  // Stabiler Identifier fürs React-`key` -- unabhängig von der Sprache,
  // damit ein Sprachwechsel nicht alle Toolbar-Buttons neu mountet.
  type: string;
  label: string;
  onClick: () => void;
};

type Props = {
  modules: ModuleButtonConfig[];
};

export default function ModuleToolbar({ modules }: Props) {
  return (
    <>
      {modules.map((m) => (
        <button key={m.type} className={styles.btn} onClick={m.onClick}>
          {m.label}
        </button>
      ))}
    </>
  );
}
