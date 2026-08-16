import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./SavePresetDialog.module.scss";

type Props = {
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  onCancel: () => void;
  onConfirm: (name: string, description: string | null) => void;
};

export default function SavePresetDialog({
  open,
  initialName = "",
  initialDescription = "",
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // Natives <dialog> braucht showModal()/close() statt eines display-Togglers
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open, initialName, initialDescription]);

  // Escape-Taste und Klick auf den Backdrop lösen "close" aus --
  // das synchron mit onCancel halten, sonst bleibt open=true hängen.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onCancel();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onConfirm(trimmedName, description.trim() || null);
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>
          {t("components.savePresetDialog.title")}
        </h2>

        <label className={styles.label}>
          {t("components.savePresetDialog.nameLabel")}
          <input
            className={styles.field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </label>

        <label className={styles.label}>
          {t("components.savePresetDialog.descriptionLabel")}
          <textarea
            className={styles.field}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit}>
            {t("toolbar.save")}
          </button>
          <button type="button" className={styles.submit} onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
