import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from './AdminViews.module.css';

/** Sortable <th> used by the dashboard tables. */
export default function AdminSortHeader({ sortKey, sort, onSort, className, children }) {
  const active = sort.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={styles.sortBtn} data-active={active} onClick={() => onSort(sortKey)}>
        {children}
        {active && (sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
    </th>
  );
}
