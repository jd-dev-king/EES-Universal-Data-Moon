import {
  FormEvent,
  useEffect,
  useState,
} from "react";

interface SaveQueryDialogProps {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function SaveQueryDialog({
  open,
  defaultName,
  onClose,
  onSave,
}: SaveQueryDialogProps) {
  const [name, setName] =
    useState(defaultName);

  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  if (!open) {
    return null;
  }

  function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    const trimmed =
      name.trim();

    if (!trimmed) {
      return;
    }

    onSave(trimmed);
  }

  return (
    <div
      className="save-query-overlay"
      onMouseDown={onClose}
    >
      <div
        className="save-query-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-query-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="save-query-header">
            <div>
              <span>
                SQL WORKSPACE
              </span>

              <h2 id="save-query-title">
                Save Query
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="save-query-body">
            <label>
              <span>
                Query Name
              </span>

              <input
                type="text"
                value={name}
                autoFocus
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <div className="save-query-footer">
            <button
              type="button"
              className="secondary-action"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-action"
              disabled={
                !name.trim()
              }
            >
              Save Query
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}