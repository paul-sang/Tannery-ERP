import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'date' | 'badge' | 'action';
  sortable?: boolean;
  sortKey?: string; // Optional: If the backend sort param differs from table key
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html'
})
export class DataTableComponent {
  // Using native Angular 17+ Signal Inputs
  columns = input.required<TableColumn[]>();
  data = input.required<any[]>();
  loading = input<boolean>(false);
  
  // Pagination Inputs
  totalCount = input<number>(0);
  currentPage = input<number>(1);
  pageSize = input<number>(10);
  
  // Sorting State
  activeSortColumn: string | null = null;
  activeSortDirection: 'asc' | 'desc' = 'asc';
  
  // Custom Events
  onRowClick = output<any>();
  onActionClick = output<{action: string, row: any}>();
  onPageChange = output<number>();
  onPageSizeChange = output<number>();
  onSort = output<{column: string, direction: 'asc' | 'desc'}>();

  get totalPages(): number {
    return Math.ceil(this.totalCount() / this.pageSize()) || 1;
  }

  get startIndex(): number {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  get endIndex(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.totalCount());
  }

  changePage(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.onPageChange.emit(newPage);
    }
  }

  changePageSize(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.onPageSizeChange.emit(Number(select.value));
  }

  handleRowClick(row: any) {
    this.onRowClick.emit(row);
  }

  handleAction(action: string, row: any, event: Event) {
    event.stopPropagation();
    this.onActionClick.emit({ action, row });
  }

  handleSort(column: TableColumn) {
    if (!column.sortable) return;

    const sortKey = column.sortKey || column.key;

    if (this.activeSortColumn === sortKey) {
      // Toggle direction
      this.activeSortDirection = this.activeSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to asc
      this.activeSortColumn = sortKey;
      this.activeSortDirection = 'asc';
    }

    this.onSort.emit({ column: this.activeSortColumn, direction: this.activeSortDirection });
  }
}
