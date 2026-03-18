import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { ItemFormComponent } from './item-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OffcanvasComponent } from '../../../shared/components/offcanvas/offcanvas.component';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, ItemFormComponent, OffcanvasComponent],
  templateUrl: './item-list.component.html'
})
export class ItemListComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  items = signal<Item[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);
  isFilterOpen = signal<boolean>(false);
  
  // Stock Details State
  isStockDetailsOpen = signal<boolean>(false);
  stockReportData = signal<any>(null);
  selectedItemForDetails = signal<Item | null>(null);
  activeTab = signal<'lots' | 'movements'>('lots');

  selectedItem: Item | null = null;

  // Pagination State
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Search State
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  // Filter State
  categories = signal<any[]>([]);
  filterCategoryControl = new FormControl('');
  activeCategoryFilter = signal<string>('');

  // Sorting State
  activeOrdering = signal<string>('');

  // Define columns for our smart table
  tableColumns: TableColumn[] = [
    { key: 'code', label: 'Item Code', sortable: true, sortKey: 'sku' },
    { key: 'name', label: 'Description', sortable: true },
    { key: 'category_name', label: 'Category', sortable: true, sortKey: 'category__name' },
    { key: 'current_stock', label: 'Current Stock', sortable: true },
    { key: 'uom_code', label: 'Primary UOM', sortable: true, sortKey: 'uom__name' },
    { key: 'status_badge', label: 'Status', type: 'badge', sortable: true, sortKey: 'status' },
    { key: 'actions', label: 'Actions', type: 'action' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1); // Reset page on search
      this.fetchItems();
    });

    this.fetchCategories();
    this.fetchItems();
  }

  fetchCategories() {
    this.inventoryService.getCategories(1, 100).subscribe({
      next: (res) => this.categories.set(res.results)
    });
  }

  fetchItems() {
    this.isLoading.set(true);
    this.inventoryService.getItems(this.currentPage(), this.pageSize(), this.searchQuery(), this.activeCategoryFilter(), this.activeOrdering()).subscribe({
      next: (response) => {
        // Map nested fields to flat keys for the table to read easily
        const mappedData = response.results.map((item: Item) => ({
          ...item,
          code: item.sku,
          category_name: item.category_details?.name || 'Uncategorized',
          uom_code: item.uom_details?.abbreviation || '-',
          status_badge: item.status === 'ACTIVE' ? 'Active' : 'Inactive',
          current_stock: item.current_stock
        }));
        
        this.items.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load the item catalog.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.selectedItemForDetails.set(row);
    this.stockReportData.set(null); // Clear previous data
    this.isStockDetailsOpen.set(true);
    
    // Default to movements if not lot-tracked
    this.activeTab.set(row.track_by_lot ? 'lots' : 'movements');
    
    // Fetch stock report
    this.inventoryService.getItemStockReport(row.id).subscribe({
      next: (res) => {
        this.stockReportData.set(res);
      },
      error: () => {
        this.toastService.error('Error', 'Failed to fetch stock details.');
      }
    });
  }

  closeStockDetails() {
    this.isStockDetailsOpen.set(false);
  }

  openForm(item?: Item) {
    if (item) {
      this.selectedItem = item;
    } else {
      this.selectedItem = null;
    }
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
    this.selectedItem = null;
  }

  handleTableAction(event: {action: string, row: any}) {
    if (event.action === 'edit') {
      // Find the pure item from our items signal (which contains raw IDs needed for the form)
      // Since map modifies some keys, we use the row itself, assuming row contains original keys too
      // However the row from Data Table *is* the mapped item.
      // We stored the full response in map via `...item`.
      this.openForm(event.row);
    }
  }

  openFilters() {
    this.isFilterOpen.set(true);
  }

  closeFilters() {
    this.isFilterOpen.set(false);
  }

  applyFilters() {
    this.activeCategoryFilter.set(this.filterCategoryControl.value || '');
    this.currentPage.set(1);
    this.fetchItems();
    this.closeFilters();
  }

  clearFilters() {
    this.filterCategoryControl.setValue('');
    this.activeCategoryFilter.set('');
    this.currentPage.set(1);
    this.fetchItems();
    this.closeFilters();
  }

  onItemSaved() {
    this.fetchItems(); // Refresh table
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchItems();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page
    this.fetchItems();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchItems();
  }
}
