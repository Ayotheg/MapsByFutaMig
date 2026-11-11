import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopy } from './useCopy';
import styles from './DevelopersPage.module.css';

// Code blocks for /developers and /developers/docs: an ink block with a bar
// on top. The bar holds a label, or the language tabs, and a Copy button
// (so long lines can scroll sideways without running under the button).

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = useCopy();
  return (
    <button
      type="button"
      className={styles.codeCopy}
      onClick={async () => {
        const ok = await copy(code);
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CodeBlock({ code, label }) {
  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeBar}>
        <span className={styles.codeLabel}>{label}</span>
        <CopyButton code={code} />
      </div>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * The same example in several languages. `samples` is
 * [{ id, label, code, blockLabel? }]; the chosen tab is shared through
 * `lang` / `onLang` when the page wants every block to switch together.
 */
export function CodeTabs({ samples, lang, onLang, ariaLabel = 'Language' }) {
  const [own, setOwn] = useState(samples[0]?.id);
  const current = lang ?? own;
  const pick = onLang ?? setOwn;
  const active = samples.find((s) => s.id === current) || samples[0];
  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeBar}>
        <div className={styles.codeTabs} role="tablist" aria-label={ariaLabel}>
          {samples.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active.id === s.id}
              className={`${styles.codeTab} ${active.id === s.id ? styles.codeTabActive : ''}`}
              onClick={() => pick(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <CopyButton code={active.code} />
      </div>
      <pre className={styles.code}>
        <code>{active.code}</code>
      </pre>
    </div>
  );
}
