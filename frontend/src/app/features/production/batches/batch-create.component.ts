import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductionService, ProductionProcess } from '../../../core/api/production.service';
import { InventoryService, StockLot } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-batch-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './batch-create.component.html'
})
export class BatchCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productionService = inject(ProductionService);
  private inventoryService = inject(InventoryService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  form: FormGroup;
  processes = signal<ProductionProcess[]>([]);
  availableLots = signal<StockLot[]>([]);
  isSubmitting = signal(false);
  isLoadingLots = signal(false);
  showBaseWeight = signal(false);

  constructor() {
    this.form = this.fb.group({
      process: [null, Validators.required],
      base_weight: [{value: null, disabled: true}, [Validators.required, Validators.min(0.1)]],
      quantity_hides: [null, [Validators.required, Validators.min(1)]],
      notes: [''],
      initial_lots: this.fb.array([])
    });
  }

  get initialLots() {
    return this.form.get('initial_lots') as FormArray;
  }

  ngOnInit() {
    this.loadProcesses();
    this.loadLots();

    this.form.get('process')?.valueChanges.subscribe(processId => {
      const process = this.processes().find(p => p.id === processId);
      if (process) {
        // A process needs a base weight if any chemical has an actual physical item
        const hasChemicals = process.chemicals && process.chemicals.some((c: any) => c.item !== null && c.item !== undefined);
        this.showBaseWeight.set(hasChemicals);
        
        const baseWeightControl = this.form.get('base_weight');
        if (hasChemicals) {
          baseWeightControl?.enable();
          baseWeightControl?.setValidators([Validators.required, Validators.min(0.1)]);
        } else {
          baseWeightControl?.disable();
          baseWeightControl?.clearValidators();
        }
        baseWeightControl?.updateValueAndValidity();
      }
    });
  }

  loadProcesses() {
    this.productionService.getProcesses(1, 100, undefined, undefined, undefined, 'true').subscribe({
      next: (res) => this.processes.set(res.results),
      error: () => this.toastService.error('Error', 'Failed to load recipes.')
    });
  }

  loadLots() {
    this.isLoadingLots.set(true);
    this.inventoryService.getStockLots(1, 100).subscribe({
      next: (res) => {
        const activeLots = res.results.filter(lot => 
          lot.current_primary_quantity > 0 && 
          lot.item_details?.category_details?.name === 'RAW_HIDE'
        );
        this.availableLots.set(activeLots);
        this.isLoadingLots.set(false);
      },
      error: () => {
        this.toastService.error('Error', 'Failed to load available lots.');
        this.isLoadingLots.set(false);
      }
    });
  }

  get totalLotQuantity(): number {
    return this.initialLots.controls.reduce((sum, control) => sum + (Number(control.get('quantity')?.value) || 0), 0);
  }

  get expectedHides(): number {
    return Number(this.form.get('quantity_hides')?.value) || 0;
  }

  isBaseWeightRequired(): boolean {
    return this.form.get('base_weight')?.hasValidator(Validators.required) || false;
  }

  addLot() {
    const lotGroup = this.fb.group({
      lot_id: [null, Validators.required],
      quantity: [null, [Validators.required, Validators.min(0.1)]]
    });
    this.initialLots.push(lotGroup);
  }

  removeLot(index: number) {
    this.initialLots.removeAt(index);
  }

  onLotChange(index: number) {
    const group = this.initialLots.at(index);
    const lotId = group.get('lot_id')?.value;
    if (lotId) {
      const lot = this.availableLots().find(l => l.id === lotId);
      if (lot) {
        // We can set max validators or hint the user about available quantity
        group.get('quantity')?.setValidators([Validators.required, Validators.min(0.1), Validators.max(lot.current_primary_quantity)]);
        group.get('quantity')?.updateValueAndValidity();
      }
    }
  }

  getLotQuantity(lotId: any): number {
    if (!lotId) return 0;
    const lot = this.availableLots().find(l => l.id === lotId);
    return lot ? lot.current_primary_quantity : 0;
  }

  goBack() {
    this.router.navigate(['/production/batches']);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.initialLots.length > 0 && this.totalLotQuantity !== this.expectedHides) {
      this.toastService.error('Error de Validación', `La cantidad total en los lotes (${this.totalLotQuantity}) no coincide con la cantidad especificada en los parámetros (${this.expectedHides}).`);
      return;
    }

    this.isSubmitting.set(true);
    
    // Prepare payload. We need to append item_id for each lot for the backend.
    const rawFormValue = this.form.getRawValue();
    const payload = {
      process: rawFormValue.process,
      base_weight: rawFormValue.base_weight || null,
      quantity_hides: rawFormValue.quantity_hides,
      notes: rawFormValue.notes,
      initial_lots: rawFormValue.initial_lots.map((l: any) => {
        const lotInfo = this.availableLots().find(lot => lot.id === l.lot_id);
        return {
          lot_id: l.lot_id,
          quantity: l.quantity,
          item_id: lotInfo ? lotInfo.item_details.id : null
        };
      })
    };

    this.productionService.createBatch(payload).subscribe({
      next: (res) => {
        this.toastService.success('Success', `Batch ${res.batch_number} created successfully.`);
        this.isSubmitting.set(false);
        this.router.navigate(['/production/batches', res.id]);
      },
      error: () => {
        this.toastService.error('Error', 'Failed to create batch.');
        this.isSubmitting.set(false);
      }
    });
  }
}
