import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { SalesService, Customer } from '../../../core/api/sales.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-sales-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './sales-form.component.html'
})
export class SalesFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private salesService = inject(SalesService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() orderSaved = new EventEmitter<any>();

  form: FormGroup;
  customers: Customer[] = [];
  isSubmitting = false;

  statusOptions = [
    'Draft',
    'Confirmed',
    'Dispatched',
    'Delivered',
    'Cancelled'
  ];

  constructor() {
    this.form = this.fb.group({
      so_number: ['', Validators.required],
      customer: [null, Validators.required],
      status: ['Draft', Validators.required],
      order_date: ['', Validators.required],
      expected_dispatch: ['']
    });
  }

  ngOnInit() {
    this.salesService.getCustomers(1, 100).subscribe((res) => {
      this.customers = res.results;
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = { ...this.form.value };
    if (!payload.expected_dispatch) payload.expected_dispatch = null;

    this.isSubmitting = true;
    this.salesService.createOrder(payload).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', `Sales Order created successfully.`);
        this.isSubmitting = false;
        this.form.reset({ status: 'Draft' });
        this.orderSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        this.toastService.error('Error', 'Failed to save SO. Check number uniqueness.');
        this.isSubmitting = false;
      }
    });
  }
}
