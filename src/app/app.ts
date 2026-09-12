import { Component } from '@angular/core';
import { CashFlowTable } from './ui/cash-flow-table/cash-flow-table';
import { PositionFields } from './ui/position-fields/position-fields';
import { ResultsPanel } from './ui/results-panel/results-panel';
import { YamlPanel } from './ui/yaml-panel/yaml-panel';

@Component({
  selector: 'app-root',
  imports: [PositionFields, CashFlowTable, ResultsPanel, YamlPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
