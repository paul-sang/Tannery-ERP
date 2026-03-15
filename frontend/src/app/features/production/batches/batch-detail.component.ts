import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductionService, BatchSummary, ProductionBatch } from '../../../core/api/production.service';
import { InventoryService } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './batch-detail.component.html'
})
export class BatchDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productionService = inject(ProductionService);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  batchId = 0;
  summary = signal<BatchSummary | null>(null);
  isLoading = signal(true);

  // Consume / Produce modals
  isConsumeOpen = signal(false);
  isProduceOpen = signal(false);
  consumeForm: FormGroup;
  produceForm: FormGroup;
  allItems: any[] = [];
  filteredItems = signal<any[]>([]);
  activeSearchCtx = signal<{ form: string; index: number } | null>(null);
  isSubmitting = false;

  constructor() {
    this.consumeForm = this.fb.group({ lines: this.fb.array([]) });
    this.produceForm = this.fb.group({ lines: this.fb.array([]) });
  }

  get consumeLines(): FormArray { return this.consumeForm.get('lines') as FormArray; }
  get produceLines(): FormArray { return this.produceForm.get('lines') as FormArray; }

  ngOnInit() {
    this.batchId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSummary();
    this.inventoryService.getItems(1, 200).subscribe(res => {
      this.allItems = res.results.filter((i: any) => i.status === 'ACTIVE');
    });
  }

  loadSummary() {
    this.isLoading.set(true);
    this.productionService.batchSummary(this.batchId).subscribe({
      next: (data) => { this.summary.set(data); this.isLoading.set(false); },
      error: () => { this.toastService.error('Error', 'Failed to load batch summary.'); this.isLoading.set(false); }
    });
  }

  goBack() { this.router.navigate(['/production/batches']); }

  // --- Status controls ---
  updateStatus(newStatus: string) {
    this.productionService.updateBatchStatus(this.batchId, newStatus).subscribe({
      next: () => {
        this.toastService.success('Status Updated', `Batch moved to ${newStatus.replace('_', ' ')}.`);
        this.loadSummary();
      },
      error: () => this.toastService.error('Error', 'Failed to update status.')
    });
  }

  // --- Consume modal ---
  openConsume() {
    this.consumeLines.clear();
    // Pre-populate from recipe inputs
    const recipe = this.summary()?.recipe;
    recipe?.expected_inputs?.forEach(inp => {
      this.consumeLines.push(this.createLine(inp.item, inp.item_details?.name || '', inp.item_details?.track_by_lot || false));
    });
    recipe?.chemicals?.forEach(chem => {
      this.consumeLines.push(this.createLine(chem.item, chem.item_details?.name || '', chem.item_details?.track_by_lot || false));
    });
    this.isConsumeOpen.set(true);
  }

  // --- Produce modal ---
  openProduce() {
    this.produceLines.clear();
    const recipe = this.summary()?.recipe;
    recipe?.expected_outputs?.forEach(out => {
      this.produceLines.push(this.createLine(out.item, out.item_details?.name || '', out.item_details?.track_by_lot || false));
    });
    this.isProduceOpen.set(true);
  }

  createLine(itemId?: number, itemName?: string, trackByLot?: boolean): FormGroup {
    return this.fb.group({
      item: [itemId || null, Validators.required],
      _item_name: [itemName ? `${itemName}` : ''],
      _track_by_lot: [trackByLot || false],
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      lot_tracking_number: [''],
      notes: ['']
    });
  }

  addConsumeLine() { this.consumeLines.push(this.createLine()); }
  addProduceLine() { this.produceLines.push(this.createLine()); }
  removeConsumeLine(i: number) { this.consumeLines.removeAt(i); }
  removeProduceLine(i: number) { this.produceLines.removeAt(i); }

  // --- Item search ---
  onItemSearch(query: string, formType: string, index: number) {
    this.activeSearchCtx.set({ form: formType, index });
    if (!query || query.length < 1) { this.filteredItems.set([]); return; }
    const lower = query.toLowerCase();
    this.filteredItems.set(this.allItems.filter((i: any) => i.sku.toLowerCase().includes(lower) || i.name.toLowerCase().includes(lower)).slice(0, 8));
  }

  selectItem(item: any, formType: string, index: number) {
    const lines = formType === 'consume' ? this.consumeLines : this.produceLines;
    const line = lines.at(index);
    line.patchValue({ item: item.id, _item_name: `${item.sku} - ${item.name}`, _track_by_lot: item.track_by_lot });
    this.filteredItems.set([]);
    this.activeSearchCtx.set(null);
  }

  clearSearch() { setTimeout(() => { this.filteredItems.set([]); this.activeSearchCtx.set(null); }, 200); }
  isSearchActive(formType: string, index: number): boolean { const c = this.activeSearchCtx(); return c?.form === formType && c?.index === index; }

  // --- Submit consumption ---
  submitConsume() {
    if (this.consumeLines.length === 0) return;
    this.isSubmitting = true;
    const lines = this.consumeLines.controls.map(c => ({
      item: c.value.item, movement_type: 'OUT', quantity: c.value.quantity,
      lot_tracking_number: c.value.lot_tracking_number || '', notes: c.value.notes || ''
    }));
    this.productionService.consumeBatch(this.batchId, lines).subscribe({
      next: (res: any) => {
        this.toastService.success('Consumption Recorded', res.detail);
        this.isSubmitting = false;
        this.isConsumeOpen.set(false);
        this.loadSummary();
      },
      error: (err: any) => {
        this.toastService.error('Error', err.error?.detail || 'Failed to record consumption.');
        this.isSubmitting = false;
      }
    });
  }

  // --- Submit production ---
  submitProduce() {
    if (this.produceLines.length === 0) return;
    this.isSubmitting = true;
    const lines = this.produceLines.controls.map(c => ({
      item: c.value.item, movement_type: 'IN', quantity: c.value.quantity,
      lot_tracking_number: c.value.lot_tracking_number || '', notes: c.value.notes || ''
    }));
    this.productionService.produceBatch(this.batchId, lines).subscribe({
      next: (res: any) => {
        this.toastService.success('Output Recorded', res.detail);
        this.isSubmitting = false;
        this.isProduceOpen.set(false);
        this.loadSummary();
      },
      error: (err: any) => {
        this.toastService.error('Error', err.error?.detail || 'Failed to record output.');
        this.isSubmitting = false;
      }
    });
  }
}
