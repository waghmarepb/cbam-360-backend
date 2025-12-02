import mongoose from 'mongoose';
import Calculation from '../models/Calculation';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import Product from '../models/Product';
import { Supplier } from '../models/Supplier';
import ReportingPeriod from '../models/ReportingPeriod';
import Organisation from '../models/Organisation';

interface ExportOptions {
  organisationId: mongoose.Types.ObjectId;
  reportingPeriodId?: mongoose.Types.ObjectId;
}

export class ExportService {
  private orgId: mongoose.Types.ObjectId;
  private periodId?: mongoose.Types.ObjectId;

  constructor(options: ExportOptions) {
    this.orgId = options.organisationId;
    this.periodId = options.reportingPeriodId;
  }

  // Export calculations to CSV
  async exportCalculations(): Promise<string> {
    const filter: Record<string, unknown> = { organisation: this.orgId };
    if (this.periodId) filter.reportingPeriod = this.periodId;

    const calculations = await Calculation.find(filter)
      .populate('reportingPeriod', 'year quarter')
      .sort({ calculatedAt: -1 });

    const headers = [
      'Period', 'Product', 'CN Code', 'Production (t)',
      'Scope 1 (tCO2e)', 'Scope 2 (tCO2e)', 'Scope 3 (tCO2e)',
      'Total Emissions (tCO2e)', 'SEE Direct', 'SEE Indirect', 'SEE Total',
      'Status', 'Calculated At'
    ];

    const rows: string[][] = [];
    
    for (const calc of calculations) {
      const period = calc.reportingPeriod as unknown as { year: number; quarter: string };
      const periodName = period ? `${period.quarter} ${period.year}` : '';

      for (const product of calc.products) {
        rows.push([
          periodName,
          product.productName,
          product.cnCode,
          product.productionQuantity.toFixed(2),
          product.scope1Emissions.toFixed(4),
          product.scope2Emissions.toFixed(4),
          product.scope3TotalEmissions.toFixed(4),
          product.totalEmissions.toFixed(4),
          product.seeDirect.toFixed(6),
          product.seeIndirect.toFixed(6),
          product.seeTotal.toFixed(6),
          calc.status,
          new Date(calc.calculatedAt).toISOString()
        ]);
      }
    }

    return this.toCSV(headers, rows);
  }

  // Export activity data to CSV
  async exportActivityData(type: 'electricity' | 'fuel' | 'production' | 'precursor'): Promise<string> {
    const filter: Record<string, unknown> = { organisation: this.orgId };
    if (this.periodId) filter.reportingPeriod = this.periodId;

    switch (type) {
      case 'electricity':
        return this.exportElectricityData(filter);
      case 'fuel':
        return this.exportFuelData(filter);
      case 'production':
        return this.exportProductionData(filter);
      case 'precursor':
        return this.exportPrecursorData(filter);
      default:
        throw new Error('Invalid export type');
    }
  }

  private async exportElectricityData(filter: Record<string, unknown>): Promise<string> {
    const data = await ElectricityData.find(filter).sort({ month: 1 });

    const headers = [
      'Month', 'Grid Electricity (kWh)', 'Grid EF', 
      'Captive Electricity (kWh)', 'Captive EF',
      'Renewable Electricity (kWh)', 'Total (kWh)', 'Notes'
    ];

    const rows = data.map(d => [
      d.month.toString(),
      (d.gridElectricity || 0).toFixed(2),
      (d.gridEmissionFactor || 0).toFixed(4),
      (d.captiveElectricity || 0).toFixed(2),
      (d.captiveEmissionFactor || 0).toFixed(4),
      (d.renewableElectricity || 0).toFixed(2),
      ((d.gridElectricity || 0) + (d.captiveElectricity || 0) + (d.renewableElectricity || 0)).toFixed(2),
      d.notes || ''
    ]);

    return this.toCSV(headers, rows);
  }

  private async exportFuelData(filter: Record<string, unknown>): Promise<string> {
    const data = await FuelData.find(filter).sort({ month: 1 });

    const headers = [
      'Month', 'Fuel Name', 'Quantity', 'Unit', 'Emission Factor', 'Notes'
    ];

    const rows = data.map(d => [
      d.month.toString(),
      d.fuelName,
      d.quantity.toFixed(2),
      d.unit,
      (d.emissionFactor || 0).toFixed(4),
      d.notes || ''
    ]);

    return this.toCSV(headers, rows);
  }

  private async exportProductionData(filter: Record<string, unknown>): Promise<string> {
    const data = await ProductionData.find(filter).sort({ month: 1 });

    const headers = [
      'Month', 'Product Name', 'CN Code', 'Quantity Produced', 'Unit', 'Notes'
    ];

    const rows = data.map(d => [
      d.month.toString(),
      d.productName,
      d.cnCode || '',
      d.quantityProduced.toFixed(2),
      d.unit,
      d.notes || ''
    ]);

    return this.toCSV(headers, rows);
  }

  private async exportPrecursorData(filter: Record<string, unknown>): Promise<string> {
    const data = await PrecursorData.find(filter).sort({ month: 1 });

    const headers = [
      'Month', 'Supplier', 'Material', 'CN Code', 'Quantity', 'Unit',
      'Direct EF', 'Indirect EF', 'Total EF', 'Notes'
    ];

    const rows = data.map(d => [
      d.month.toString(),
      d.supplierName,
      d.materialName,
      d.cnCode || '',
      d.quantity.toFixed(2),
      d.unit,
      (d.directEmissionFactor || 0).toFixed(4),
      (d.indirectEmissionFactor || 0).toFixed(4),
      ((d.directEmissionFactor || 0) + (d.indirectEmissionFactor || 0)).toFixed(4),
      d.notes || ''
    ]);

    return this.toCSV(headers, rows);
  }

  // Export products list
  async exportProducts(): Promise<string> {
    const products = await Product.find({ 
      organisation: this.orgId,
      isActive: true 
    }).sort({ name: 1 });

    const headers = ['Product Name', 'CN Code', 'Description', 'Unit', 'Created At'];

    const rows = products.map(p => [
      p.name,
      p.cnCode,
      p.description || '',
      p.unit,
      new Date(p.createdAt).toISOString()
    ]);

    return this.toCSV(headers, rows);
  }

  // Export suppliers list
  async exportSuppliers(): Promise<string> {
    const suppliers = await Supplier.find({ organisation: this.orgId }).sort({ name: 1 });

    const headers = [
      'Supplier Name', 'Country', 'Email', 'Phone',
      'Street', 'City', 'Postal Code', 'Status'
    ];

    const rows = suppliers.map(s => [
      s.name,
      s.address?.countryCode || '',
      s.contactEmail || '',
      s.contactPhone || '',
      s.address?.street || '',
      s.address?.city || '',
      s.address?.postalCode || '',
      s.status
    ]);

    return this.toCSV(headers, rows);
  }

  // Export full emissions summary
  async exportEmissionsSummary(): Promise<string> {
    const [organisation, periods, calculations] = await Promise.all([
      Organisation.findById(this.orgId),
      ReportingPeriod.find({ organisation: this.orgId }).sort({ year: -1, quarter: -1 }),
      Calculation.find({ organisation: this.orgId }).populate('reportingPeriod', 'year quarter')
    ]);

    const headers = [
      'Organisation', 'Period', 'Total Scope 1', 'Total Scope 2', 'Total Scope 3',
      'Total Emissions', 'Total Production', 'Average SEE', 'Status'
    ];

    const rows: string[][] = [];

    for (const calc of calculations) {
      const period = calc.reportingPeriod as unknown as { year: number; quarter: string };
      const avgSEE = calc.products.length > 0
        ? calc.products.reduce((sum, p) => sum + p.seeTotal, 0) / calc.products.length
        : 0;

      rows.push([
        organisation?.name || '',
        period ? `${period.quarter} ${period.year}` : '',
        calc.totalScope1.toFixed(4),
        calc.totalScope2.toFixed(4),
        calc.totalScope3.toFixed(4),
        calc.totalEmissions.toFixed(4),
        calc.totalProduction.toFixed(2),
        avgSEE.toFixed(6),
        calc.status
      ]);
    }

    return this.toCSV(headers, rows);
  }

  private toCSV(headers: string[], rows: string[][]): string {
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = rows.map(row => row.map(escapeCSV).join(','));

    return [headerLine, ...dataLines].join('\n');
  }
}

export default ExportService;

