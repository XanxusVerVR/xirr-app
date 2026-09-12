import { Component } from '@angular/core';
import { PositionFields } from './ui/position-fields/position-fields';

@Component({
  selector: 'app-root',
  imports: [PositionFields],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
