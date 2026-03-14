import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, StockLot, Item } from '../../../core/api/inventory.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { AdjustmentFormComponent } from './adjustment-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-stocklot-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, AdjustmentFormComponent],
  templateUrl: './stocklot-list.component.html'
})
export class StocklotListComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  // Tab State
  activeTab = signal<'lots' | 'general'>('lots');

  // Lot-tracked data
  lots = signal<any[]>([]);
  isLotsLoading = signal<boolean>(true);
  totalLots = signal<number>(0);
  lotsPage = signal<number>(1);
  lotsPageSize = signal<number>(10);
  lotsSearch = new FormControl('');
  lotsSearchQuery = signal<string>('');
  lotsOrdering = signal<string>('');

  // General stock data
  generalItems = signal<any[]>([]);
  isGeneralLoading = signal<boolean>(true);
  totalGeneralItems = signal<number>(0);
  generalPage = signal<number>(1);
  generalPageSize = signal<number>(10);
  generalSearch = new FormControl('');
  generalSearchQuery = signal<string>('');
  generalOrdering = signal<string>('');

  // Form state
  isFormOpen = signal<boolean>(false);

  // Table columns for lots
  lotColumns: TableColumn[] = [
    { key: 'lot_number', label: 'Lot Number', sortable: true, sortKey: 'lot_tracking_number' },
    { key: 'item_name', label: 'Item' },
    { key: 'primary_balance', label: 'Primary Qty', sortable: true, sortKey: 'current_primary_quantity' },
    { key: 'secondary_balance', label: 'Secondary Qty' }
  ];

  // Table columns for general stock
  generalColumns: TableColumn[] = [
    { key: 'code', label: 'SKU', sortable: true, sortKey: 'sku' },
    { key: 'name', label: 'Item Name', sortable: true },
    { key: 'category_name', label: 'Category' },
    { key: 'stock_display', label: 'Current Stock', sortable: true, sortKey: 'current_stock' },
    { key: 'status_badge', label: 'Status', type: 'badge' }
  ];

  ngOnInit() {
    this.lotsSearch.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.lotsSearchQuery.set(value || '');
      this.lotsPage.set(1);
      this.fetchLots();
    });

    this.generalSearch.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.generalSearchQuery.set(value || '');
      this.generalPage.set(1);
      this.fetchGeneralItems();
    });

    this.fetchLots();
    this.fetchGeneralItems();
  }

  switchTab(tab: 'lots' | 'general') {
    this.activeTab.set(tab);
  }

  // --- Lot-tracked fetching ---
  fetchLots() {
    this.isLotsLoading.set(true);
    this.inventoryService.getStockLots(this.lotsPage(), this.lotsPageSize(), undefined, this.lotsSearchQuery(), this.lotsOrdering()).subscribe({
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
        this.totalLots.set(response.count);
        this.isLotsLoading.set(false);
      },
      error: () => {
        this.toastService.error('Sync Error', 'Failed to retrieve Stock Lots.');
        this.isLotsLoading.set(false);
      }
    });
  }

  // --- General stock fetching ---
  fetchGeneralItems() {
    this.isGeneralLoading.set(true);
    this.inventoryService.getItems(this.generalPage(), this.generalPageSize(), this.generalSearchQuery(), undefined, this.generalOrdering(), false).subscribe({
      next: (response) => {
        const mappedData = response.results.map((item: Item) => ({
          ...item,
          code: item.sku,
          category_name: item.category_details?.name || 'Uncategorized',
          stock_display: `${item.current_stock || 0} ${item.uom_details?.abbreviation || ''}`,
          status_badge: item.status === 'ACTIVE' ? 'Active' : 'Inactive'
        }));
        this.generalItems.set(mappedData as any);
        this.totalGeneralItems.set(response.count);
        this.isGeneralLoading.set(false);
      },
      error: () => {
        this.toastService.error('Sync Error', 'Failed to retrieve general stock items.');
        this.isGeneralLoading.set(false);
      }
    });
  }

  onLotRowClick(row: any) {
    this.toastService.success('Lot Selected', `Tracking for lot ${row.lot_number} opened.`);
  }

  onGeneralRowClick(row: any) {
    this.toastService.success('Item Selected', `Stock details for ${row.name} opened.`);
  }

  openForm() {
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  onDocumentSaved() {
    this.fetchLots();
    this.fetchGeneralItems();
  }

  // --- Lot pagination/sorting ---
  onLotsPageChange(page: number) {
    this.lotsPage.set(page);
    this.fetchLots();
  }

  onLotsPageSizeChange(size: number) {
    this.lotsPageSize.set(size);
    this.lotsPage.set(1);
    this.fetchLots();
  }

  onLotsSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.lotsOrdering.set(`${orderPrefix}${event.column}`);
    this.lotsPage.set(1);
    this.fetchLots();
  }

  // --- General pagination/sorting ---
  onGeneralPageChange(page: number) {
    this.generalPage.set(page);
    this.fetchGeneralItems();
  }

  onGeneralPageSizeChange(size: number) {
    this.generalPageSize.set(size);
    this.generalPage.set(1);
    this.fetchGeneralItems();
  }

  onGeneralSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.generalOrdering.set(`${orderPrefix}${event.column}`);
    this.generalPage.set(1);
    this.fetchGeneralItems();
  }
}
