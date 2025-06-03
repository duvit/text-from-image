import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

interface TextExtractionResult {
  text: string;
  bounding_box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

@Component({
  selector: 'app-text-extractor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './text-extractor.component.html',
  styleUrls: ['./text-extractor.component.scss']
})
export class TextExtractorComponent {
  fileName: string = '';
  validFileSize: number = 2000000; //in bytes
  uploadProgress: number | null = null;
  extractedText: string = '';
  errorMessage: string | null = null;
  isLoading: boolean = false;
  imagePreview: string | null = null;
  isCopied: boolean = false;

  private allowedExtensions = ['jpg', 'jpeg', 'png'];

  constructor(private http: HttpClient) { }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      this.errorMessage = 'Please select a file to upload.';
      return;
    }

    const file: File = input.files[0];
    if (!this.validateFile(file)) {
      return;
    }

    this.fileName = file.name;
    this.generatePreview(file);
    this.uploadFile(file);
  }

  private validateFile(file: File): boolean {
    if (file.size > this.validFileSize) {
      this.errorMessage = 'The file size must not exceed 2MB.';
      return false;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !this.allowedExtensions.includes(fileExtension)) {
      this.errorMessage = 'Only JPEG and PNG files are allowed.';
      return false;
    }

    this.errorMessage = null;
    return true;
  }

  private generatePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  private uploadFile(file: File): void {
    this.isLoading = true;
    const formData = new FormData();
    formData.append('image', file);

    const headers = new HttpHeaders({
      'X-Api-Key': environment.apiKey
    });

    this.http
      .post<TextExtractionResult[]>('https://api.api-ninjas.com/v1/imagetotext', formData, { headers })
      .pipe(take(1), finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (body) => {
          this.extractedText = this.formatText(body);
          this.errorMessage = null;
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Upload failed';
        }
      });
  }

  private formatText(results: TextExtractionResult[]): string {
    if (!results.length) return '';

    const avgHeight =
      results.reduce((sum, item) => sum + (item.bounding_box.y2 - item.bounding_box.y1), 0) /
      results.length;
    const lineThreshold = avgHeight * 1.5;

    const sortedResults = [...results].sort(
      (a, b) => a.bounding_box.y1 - b.bounding_box.y1
    );

    const lines: TextExtractionResult[][] = [];
    let currentLine: TextExtractionResult[] = [sortedResults[0]];

    for (let i = 1; i < sortedResults.length; i++) {
      const prev = sortedResults[i - 1];
      const curr = sortedResults[i];

      const verticalDistance = curr.bounding_box.y1 - prev.bounding_box.y1;

      if (verticalDistance <= lineThreshold) {
        currentLine.push(curr);
      } else {
        lines.push(currentLine);
        currentLine = [curr];
      }
    }
    lines.push(currentLine);

    return lines
      .map((line) =>
        line
          .sort((a, b) => a.bounding_box.x1 - b.bounding_box.x1)
          .map((item) => item.text.trim())
          .join(' ')
      )
      .join('\n');
  }


  copyText(): void {
    if (this.extractedText) {
      navigator.clipboard.writeText(this.extractedText).then(() => {
        this.isCopied = true;
        setTimeout(() => (this.isCopied = false), 2000);
      }).catch(() => {
        this.errorMessage = 'Failed to copy text.';
      });
    }
  }
}