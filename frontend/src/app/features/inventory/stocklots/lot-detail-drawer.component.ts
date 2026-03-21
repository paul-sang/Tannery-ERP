import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerComponent } from '../../../shared/components/drawer/drawer.component';
import { InventoryService } from '../../../core/api/inventory.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-lot-detail-drawer',
  standalone: true,
  imports: [CommonModule, DrawerComponent, DataTableComponent],
  providers: [DatePipe],
  template: `
    <app-drawer [isOpen]="isOpen" [title]="'Lot Details: ' + (lot()?.lot_tracking_number || '')" (closeDrawer)="close()">
      <div *ngIf="isLoading()" class="flex justify-center p-8">
        <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <div *ngIf="!isLoading() && lot()" class="space-y-6">
        
        <!-- Header Info -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="p-3 bg-primary/10 text-primary rounded-lg">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <div>
            <h3 class="text-xl font-bold text-text">{{ lot()?.item_details?.name }}</h3>
            <p class="text-sm text-text-muted">SKU: {{ lot()?.item_details?.sku }}</p>
          </div>
        </div>

        <!-- Balances Card -->
        <div class="bg-surface-alt rounded-lg border border-border p-4 shadow-sm">
          <h4 class="text-sm font-semibold text-text mb-3 uppercase tracking-wider">Current Balances</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-text-muted">Primary Qty ({{ lot()?.item_details?.uom_details?.abbreviation }})</p>
              <p class="text-2xl font-bold text-text">{{ lot()?.current_primary_quantity }}</p>
            </div>
            <div>
              <p class="text-xs text-text-muted">Secondary Qty ({{ lot()?.item_details?.secondary_uom_details?.abbreviation || 'N/A' }})</p>
              <p class="text-xl font-semibold text-text">{{ lot()?.current_secondary_quantity !== null ? lot()?.current_secondary_quantity : '-' }}</p>
            </div>
          </div>
        </div>

        <!-- Quality & Location Card -->
        <div class="bg-surface-alt rounded-lg border border-border p-4 shadow-sm">
          <h4 class="text-sm font-semibold text-text mb-3 uppercase tracking-wider">Lot Properties</h4>
          <div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
            <div>
              <span class="text-text-muted block text-xs">Location</span>
              <span class="font-medium text-text">{{ lot()?.location_details?.name || 'Unassigned' }}</span>
            </div>
            <div>
              <span class="text-text-muted block text-xs">Expiry Date</span>
              <span class="font-medium text-text">{{ lot()?.expiry_date ? (lot()?.expiry_date | date) : 'N/A' }}</span>
            </div>
            <div>
              <span class="text-text-muted block text-xs">Grade</span>
              <span class="font-medium text-text">{{ lot()?.grade !== 'NA' ? lot()?.grade : 'N/A' }}</span>
            </div>
            <div>
              <span class="text-text-muted block text-xs">Thickness</span>
              <span class="font-medium text-text">{{ lot()?.thickness || 'N/A' }}</span>
            </div>
            <div>
              <span class="text-text-muted block text-xs">Average Size</span>
              <span class="font-medium text-text">{{ lot()?.average_size || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Kardex / History -->
        <div>
          <h4 class="text-sm font-semibold text-text mb-3 uppercase tracking-wider">Movement History (Kardex)</h4>
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

      </div>
    </app-drawer>
  `
})
export class LotDetailDrawerComponent implements OnChanges {
  @Input() isOpen: boolean = false;
  @Input() lotId: number | null = null;
  @Output() closeDrawer = new EventEmitter<void>();

  private inventoryService = inject(InventoryService);
  private datePipe = inject(DatePipe);

  lot = signal<any>(null);
  isLoading = signal<boolean>(false);

  movements = signal<any[]>([]);
  isMovementsLoading = signal<boolean>(false);
  totalMovements = signal<number>(0);
  movementsPage = signal<number>(1);
  movementsPageSize = signal<number>(5);

  movementColumns: TableColumn[] = [
    { key: 'date_display', label: 'Date' },
    { key: 'movement_type', label: 'Type' },
    { key: 'document_number', label: 'Document' },
    { key: 'quantity_display', label: 'Qty' },
  ];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.lotId) {
      this.loadLotDetails();
      this.loadMovements();
    }
    if (!this.isOpen) {
      this.lot.set(null);
      this.movements.set([]);
    }
  }

  loadLotDetails() {
    if (!this.lotId) return;
    this.isLoading.set(true);
    this.inventoryService.getLot(this.lotId).subscribe({
      next: (data) => {
        this.lot.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadMovements() {
    if (!this.lotId) return;
    this.isMovementsLoading.set(true);
    this.inventoryService.getStockMovements(this.movementsPage(), this.movementsPageSize(), undefined, this.lotId).subscribe({
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

  onMovementsPageChange(page: number) {
    this.movementsPage.set(page);
    this.loadMovements();
  }

  close() {
    this.closeDrawer.emit();
  }
}
