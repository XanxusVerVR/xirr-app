import { Component } from '@angular/core';
import { CashFlowTable } from './ui/cash-flow-table/cash-flow-table';
import { PositionFields } from './ui/position-fields/position-fields';

@Component({
  selector: 'app-root',
  imports: [PositionFields, CashFlowTable],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
