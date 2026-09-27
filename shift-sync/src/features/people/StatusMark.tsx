import styles from './StatusMark.module.css';

/** A dot and a word, never a dimmed row: an inactive person must stay easy to read. */
export function StatusMark({ status }: { status: 'active' | 'inactive' }) {
  return <span class={styles.mark}><i class={`${styles.dot} ${status === 'active' ? styles.on : ''}`} />{status === 'active' ? 'Active' : 'Inactive'}</span>;
}
