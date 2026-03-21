import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerComponent } from '../../../shared/components/drawer/drawer.component';
import { InventoryService } from '../../../core/api/inventory.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { DatePipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-item-detail-drawer',
  standalone: true,
  imports: [CommonModule, DrawerComponent, DataTableComponent],
  providers: [DatePipe, CurrencyPipe],
  template: `
    <app-drawer [isOpen]="isOpen" [title]="'Item Details: ' + (item()?.sku || '')" (closeDrawer)="close()">
      <div *ngIf="isLoading()" class="flex justify-center p-8">
        <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <div *ngIf="!isLoading() && item()" class="space-y-6">
        
        <!-- Header Info -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="p-3 bg-info/10 text-info-foreground rounded-lg">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-text">{{ item()?.name }}</h3>
            <p class="text-sm text-text-muted">{{ item()?.category_details?.name }}</p>
          </div>
        </div>

        <!-- Metrics Card -->
        <div class="bg-surface-alt rounded-lg border border-border p-4 shadow-sm">
          <h4 class="text-sm font-semibold text-text mb-3 uppercase tracking-wider">Stock Metrics</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p class="text-xs text-text-muted">Current Stock</p>
              <p class="text-lg font-bold text-text">{{ item()?.current_stock }} {{ item()?.uom_details?.abbreviation }}</p>
            </div>
            <div>
              <p class="text-xs text-text-muted">Min Level</p>
              <p class="text-lg font-medium text-text">{{ item()?.min_stock_level }}</p>
            </div>
            <div>
              <p class="text-xs text-text-muted">Reorder Point</p>
              <p class="text-lg font-medium text-text">{{ item()?.reorder_point || '0.00' }}</p>
            </div>
            <div>
              <p class="text-xs text-text-muted">Current Price</p>
              <p class="text-lg font-medium text-text">{{ item()?.current_unit_price | currency }}</p>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="border-b border-border">
          <nav class="-mb-px flex space-x-6" aria-label="Tabs">
            <button 
              (click)="activeTab.set('movements')" 
              [ngClass]="activeTab() === 'movements' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text hover:border-border'" 
              class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm cursor-pointer transition">
              Kardex History
            </button>
            <button 
              (click)="activeTab.set('pricing')" 
              [ngClass]="activeTab() === 'pricing' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text hover:border-border'" 
              class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm cursor-pointer transition">
              Price History
            </button>
          </nav>
        </div>

        <!-- Kardex Tab -->
        <div *ngIf="activeTab() === 'movements'">
          <app-data-table 
            [columns]="movementColumns" 
            [data]="movements()" 
            [loading]="isMovementsLoading()"
            [totalCount]="totalMovements()"
            [currentPage]="movementsPage()"
            [pageSize]="movementsPageSize()"
            (onPageChange)="onMovementsPageChange($event)">
          </app-data-table>
        </div>

        <!-- Pricing Tab -->
        <div *ngIf="activeTab() === 'pricing'">
          <app-data-table 
            [columns]="pricingColumns" 
            [data]="prices()" 
            [loading]="isPricesLoading()"
            [totalCount]="totalPrices()"
            [currentPage]="pricesPage()"
            [pageSize]="pricesPageSize()"
            (onPageChange)="onPricesPageChange($event)">
          </app-data-table>
        </div>

      </div>
    </app-drawer>
  `
})
export class ItemDetailDrawerComponent implements OnChanges {
  @Input() isOpen: boolean = false;
  @Input() itemId: number | null = null;
  @Output() closeDrawer = new EventEmitter<void>();

  private inventoryService = inject(InventoryService);
  private datePipe = inject(DatePipe);
  private currencyPipe = inject(CurrencyPipe);

  activeTab = signal<'movements' | 'pricing'>('movements');

  item = signal<any>(null);
  isLoading = signal<boolean>(false);

  movements = signal<any[]>([]);
  isMovementsLoading = signal<boolean>(false);
  totalMovements = signal<number>(0);
  movementsPage = signal<number>(1);
  movementsPageSize = signal<number>(5);

  prices = signal<any[]>([]);
  isPricesLoading = signal<boolean>(false);
  totalPrices = signal<number>(0);
  pricesPage = signal<number>(1);
  pricesPageSize = signal<number>(5);

  movementColumns: TableColumn[] = [
    { key: 'date_display', label: 'Date' },
    { key: 'movement_type', label: 'Type' },
    { key: 'document_number', label: 'Doc' },
    { key: 'quantity_display', label: 'Qty' },
  ];

  pricingColumns: TableColumn[] = [
    { key: 'date_display', label: 'Date' },
    { key: 'price_display', label: 'Price' },
    { key: 'source', label: 'Source' },
  ];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.itemId) {
      this.loadItemDetails();
      this.loadMovements();
      this.loadPrices();
    }
    if (!this.isOpen) {
      this.item.set(null);
      this.movements.set([]);
      this.prices.set([]);
    }
  }

  loadItemDetails() {
    if (!this.itemId) return;
    this.isLoading.set(true);
    this.inventoryService.getItem(this.itemId).subscribe({
      next: (data) => {
        this.item.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadMovements() {
    if (!this.itemId) return;
    this.isMovementsLoading.set(true);
    this.inventoryService.getStockMovements(this.movementsPage(), this.movementsPageSize(), this.itemId).subscribe({
      next: (response) => {
        const mappedData = response.results.map((m: any) => ({
          ...m,
          date_display: this.datePipe.transform(m.date, 'short'),
          quantity_display: `${m.movement_type === 'IN' ? '+' : '-'}${m.quantity}`
        }));
        this.movements.set(mappedData);
        this.totalMovements.set(response.count);
        this.isMovementsLoading.set(false);
      },
      error: () => this.isMovementsLoading.set(false)
    });
  }

  loadPrices() {
    if (!this.itemId) return;
    this.isPricesLoading.set(true);
    this.inventoryService.getItemPriceHistory(this.itemId, this.pricesPage(), this.pricesPageSize()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((p: any) => ({
          ...p,
          date_display: this.datePipe.transform(p.effective_date, 'mediumDate'),
          price_display: this.currencyPipe.transform(p.price, p.currency)
        }));
        this.prices.set(mappedData);
        this.totalPrices.set(response.count);
        this.isPricesLoading.set(false);
      },
      error: () => this.isPricesLoading.set(false)
    });
  }

  onMovementsPageChange(page: number) {
    this.movementsPage.set(page);
    this.loadMovements();
  }

  onPricesPageChange(page: number) {
    this.pricesPage.set(page);
    this.loadPrices();
  }

  close() {
    this.closeDrawer.emit();
  }
}
