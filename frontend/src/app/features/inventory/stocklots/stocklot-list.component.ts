import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, StockLot } from '../../../core/api/inventory.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { StocklotFormComponent } from './stocklot-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-stocklot-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, StocklotFormComponent],
  templateUrl: './stocklot-list.component.html'
})
export class StocklotListComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  lots = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);

  // Pagination State
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Search State
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  // Sorting State
  activeOrdering = signal<string>('');

  // Define columns for our smart table focused on physical balances
  tableColumns: TableColumn[] = [
    { key: 'lot_number', label: 'Lot Number', sortable: true, sortKey: 'lot_tracking_number' },
    { key: 'item_name', label: 'Item' },
    { key: 'primary_balance', label: 'Primary Qty', sortable: true, sortKey: 'current_primary_quantity' },
    { key: 'secondary_balance', label: 'Secondary Qty' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchLots();
    });

    this.fetchLots();
  }

  fetchLots() {
    this.isLoading.set(true);
    // getStockLots signature: (page, pageSize, itemId, search, ordering)
    this.inventoryService.getStockLots(this.currentPage(), this.pageSize(), undefined, this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((lot: StockLot) => {
          const item = lot.item_details;
          return {
            ...lot,
            lot_number: lot.lot_tracking_number,
            item_name: item ? item.name : 'Unknown',
            primary_balance: item ? `${lot.current_primary_quantity} ${item.uom_details?.abbreviation || ''}` : lot.current_primary_quantity,
            secondary_balance: (lot.current_secondary_quantity && item) ? `${lot.current_secondary_quantity} ${item.secondary_uom_details?.abbreviation || ''}` : '-'
          };
        });
        this.lots.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Sync Error', 'Failed to retrieve Stock Lots balance from the server.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.toastService.success('Lot Selected', `Tracking for lot ${row.lot_number} opened.`);
  }

  openForm() {
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  onLotSaved() {
    this.fetchLots(); // Refresh table
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchLots();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchLots();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchLots();
  }
}
