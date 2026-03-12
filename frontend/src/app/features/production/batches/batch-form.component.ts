import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ProductionService, ProductionProcess } from '../../../core/api/production.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-batch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './batch-form.component.html'
})
export class BatchFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() batchSaved = new EventEmitter<any>();

  form: FormGroup;
  processes: ProductionProcess[] = [];
  isSubmitting = false;

  statusOptions = [
    'Draft',
    'Pending',
    'In Progress',
    'Completed',
    'Cancelled'
  ];

  constructor() {
    this.form = this.fb.group({
      batch_number: ['', Validators.required],
      process: [null, Validators.required],
      status: ['Draft', Validators.required],
      started_at: [''],
      expected_completion: ['']
    });
  }

  ngOnInit() {
    this.productionService.getProcesses(1, 100).subscribe((res) => {
      this.processes = res.results;
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = { ...this.form.value };
    if (!payload.started_at) payload.started_at = null;
    if (!payload.expected_completion) payload.expected_completion = null;

    this.isSubmitting = true;
    this.productionService.createBatch(payload).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', `Production Batch created successfully.`);
        this.isSubmitting = false;
        this.form.reset({ status: 'Draft' });
        this.batchSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        this.toastService.error('Error', 'Failed to save Batch. Check batch number uniqueness.');
        this.isSubmitting = false;
      }
    });
  }
}
