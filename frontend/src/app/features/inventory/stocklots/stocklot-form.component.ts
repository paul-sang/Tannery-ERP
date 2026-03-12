import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-stocklot-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './stocklot-form.component.html'
})
export class StocklotFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() lotSaved = new EventEmitter<any>();

  form: FormGroup;
  items: Item[] = [];
  isSubmitting = false;

  constructor() {
    this.form = this.fb.group({
      item: [null, Validators.required],
      lot_tracking_number: ['', Validators.required],
      current_primary_quantity: [0, [Validators.required, Validators.min(0)]],
      current_secondary_quantity: [null]
    });
  }

  ngOnInit() {
    this.inventoryService.getItems(1, 100).subscribe((res) => {
      this.items = res.results;
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.inventoryService.createStockLot(this.form.value).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', 'Stock lot manually created/adjusted.');
        this.isSubmitting = false;
        this.form.reset({ 
          current_primary_quantity: 0,
          current_secondary_quantity: null
        });
        this.lotSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        this.toastService.error('Error', 'Failed to save Stock Lot. Ensure tracking number is unique.');
        this.isSubmitting = false;
      }
    });
  }
}
