import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PurchasesService, Supplier } from '../../../core/api/purchases.service';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './purchase-form.component.html'
})
export class PurchaseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private purchasesService = inject(PurchasesService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() orderSaved = new EventEmitter<any>();

  form: FormGroup;
  suppliers: Supplier[] = [];
  items: Item[] = [];
  isSubmitting = false;

  statusOptions = [
    'Draft',
    'Submitted',
    'Received',
    'Cancelled'
  ];

  constructor() {
    this.form = this.fb.group({
      order_number: ['', Validators.required],
      supplier: [null, Validators.required],
      status: ['DRAFT', Validators.required],
      order_date: ['', Validators.required],
      details: this.fb.array([])
    });
  }

  get details() {
    return this.form.get('details') as any;
  }

  addDetail() {
    const detailForm = this.fb.group({
      item: [null, Validators.required],
      quantity: ['', [Validators.required, Validators.min(0.01)]],
      unit_price: ['', [Validators.required, Validators.min(0)]]
    });
    this.details.push(detailForm);
  }

  removeDetail(index: number) {
    this.details.removeAt(index);
  }

  get totalAmount() {
    let total = 0;
    for (let control of this.details.controls) {
      const qty = parseFloat(control.get('quantity')?.value) || 0;
      const price = parseFloat(control.get('unit_price')?.value) || 0;
      total += qty * price;
    }
    return total;
  }

  private inventoryService = inject(InventoryService);

  ngOnInit() {
    this.purchasesService.getSuppliers(1, 100).subscribe((res) => {
      this.suppliers = res.results;
    });
    this.inventoryService.getItems(1, 1000).subscribe((res) => {
      this.items = res.results;
    });
    // Add one initial empty row
    this.addDetail();
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = { ...this.form.value };
    if (!payload.expected_delivery) payload.expected_delivery = null;

    this.isSubmitting = true;
    this.purchasesService.createOrder(payload).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', `Purchase Order created successfully.`);
        this.isSubmitting = false;
        
        // Reset form and add one initial row back
        this.form.reset({ status: 'DRAFT' });
        while (this.details.length !== 0) {
          this.details.removeAt(0);
        }
        this.addDetail();

        this.orderSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        this.toastService.error('Error', 'Failed to save PO. Check number uniqueness.');
        this.isSubmitting = false;
      }
    });
  }
}
