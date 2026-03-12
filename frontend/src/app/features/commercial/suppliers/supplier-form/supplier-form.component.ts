import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PurchasesService, Supplier } from '../../../../core/api/purchases.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './supplier-form.component.html'
})
export class SupplierFormComponent {
  private fb = inject(FormBuilder);
  private purchasesService = inject(PurchasesService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() set supplierToEdit(val: Supplier | null) {
    if (val) {
      this.isEditMode = true;
      this.editId = val.id!;
      this.form.patchValue(val);
    } else {
      this.isEditMode = false;
      this.editId = null;
      if (this.form) this.form.reset();
    }
  }

  @Output() closeForm = new EventEmitter<void>();
  @Output() supplierSaved = new EventEmitter<any>();

  form: FormGroup;
  isSubmitting = false;
  isEditMode = false;
  editId: number | null = null;

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      contact_info: [''],
      tax_id: ['']
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    
    if (this.isEditMode && this.editId) {
      this.purchasesService.updateSupplier(this.editId, this.form.value).subscribe({
        next: (res) => {
          this.toastService.success('Success', `Supplier updated successfully.`);
          this.isSubmitting = false;
          this.supplierSaved.emit(res);
          this.closeForm.emit();
        },
        error: (err) => {
          this.toastService.error('Error', 'Failed to update supplier.');
          this.isSubmitting = false;
        }
      });
    } else {
      this.purchasesService.createSupplier(this.form.value).subscribe({
        next: (res) => {
          this.toastService.success('Success', `Supplier created successfully.`);
          this.isSubmitting = false;
          this.form.reset();
          this.supplierSaved.emit(res);
          this.closeForm.emit();
        },
        error: (err) => {
          this.toastService.error('Error', 'Failed to create supplier.');
          this.isSubmitting = false;
        }
      });
    }
  }
}
