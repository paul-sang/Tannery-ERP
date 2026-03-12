import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSignal = signal<ToastMessage[]>([]);

  get toasts() {
    return this.toastsSignal.asReadonly();
  }

  show(type: ToastMessage['type'], title: string, message: string, durationMs: number = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastMessage = { id, type, title, message };
    
    this.toastsSignal.update(current => [...current, toast]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.remove(id);
      }, durationMs);
    }
  }

  success(title: string, message: string) {
    this.show('success', title, message);
  }

  error(title: string, message: string) {
    this.show('error', title, message, 6000); // Errors stay longer
  }

  remove(id: string) {
    this.toastsSignal.update(current => current.filter(t => t.id !== id));
  }
}
