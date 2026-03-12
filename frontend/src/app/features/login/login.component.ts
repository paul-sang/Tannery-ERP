import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/translation.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './login.component.html'
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    public translationService = inject(TranslationService);
    private authService = inject(AuthService);
    private router = inject(Router);

    isLoading = signal(false);
    errorMessage = signal<string | null>(null);

    loginForm = this.fb.group({
        username: ['', Validators.required],
        password: ['', Validators.required]
    });

    onSubmit() {
        if (this.loginForm.valid) {
            this.isLoading.set(true);
            this.errorMessage.set(null);
            
            this.authService.login(this.loginForm.value)
                .subscribe({
                    next: () => {
                        this.isLoading.set(false);
                        console.log('Login successful');
                        this.router.navigate(['/dashboard']);
                    },
                    error: (err) => {
                        this.isLoading.set(false);
                        console.error('Login failed', err);
                        if (err.status === 401) {
                             this.errorMessage.set('Invalid username or password');
                        } else {
                             this.errorMessage.set('Failed to connect to the server');
                        }
                    }
                });
        }
    }

    toggleLanguage() {
        const nextLang = this.translationService.currentLang === 'en' ? 'es' : 'en';
        this.translationService.setLanguage(nextLang);
    }
}
