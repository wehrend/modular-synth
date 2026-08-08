// components/ModuleToolbar.tsx
import styles from "../App.module.scss";

export type ModuleButtonConfig = {
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
        <button key={m.label} className={styles.btn} onClick={m.onClick}>
          {m.label}
        </button>
      ))}
    </>
  );
}
