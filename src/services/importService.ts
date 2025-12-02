import mongoose from 'mongoose';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import Product from '../models/Product';
import { Supplier } from '../models/Supplier';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface ImportRow {
  [key: string]: string | number | undefined;
}

// Parse CSV content to array of objects
export function parseCSV(content: string): ImportRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: ImportRow = {};
      headers.forEach((header, idx) => {
        const value = values[idx].trim().replace(/^"|"$/g, '');
        // Try to parse as number
        const num = parseFloat(value);
        row[header] = isNaN(num) ? value : num;
      });
      rows.push(row);
    }
  }

  return rows;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export class ImportService {
  private orgId: mongoose.Types.ObjectId;
  private periodId: mongoose.Types.ObjectId;
  private facilityId?: mongoose.Types.ObjectId;

  constructor(
    organisationId: mongoose.Types.ObjectId,
    reportingPeriodId: mongoose.Types.ObjectId,
    facilityId?: mongoose.Types.ObjectId
  ) {
    this.orgId = organisationId;
    this.periodId = reportingPeriodId;
    this.facilityId = facilityId;
  }

  async importElectricity(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Account for header and 0-index

      try {
        const month = this.parseNumber(row['Month'] || row['month'], 'Month', rowNum);
        if (month < 1 || month > 12) {
          throw new Error('Month must be between 1 and 12');
        }

        await ElectricityData.create({
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          facility: this.facilityId,
          month,
          gridElectricity: this.parseNumber(row['Grid Electricity (kWh)'] || row['gridElectricity'] || 0, 'Grid Electricity', rowNum),
          gridEmissionFactor: this.parseNumber(row['Grid Emission Factor'] || row['gridEmissionFactor'] || 0.716, 'Grid EF', rowNum),
          captiveElectricity: this.parseNumber(row['Captive/DG Electricity (kWh)'] || row['captiveElectricity'] || 0, 'Captive Electricity', rowNum),
          captiveEmissionFactor: this.parseNumber(row['Captive Emission Factor'] || row['captiveEmissionFactor'] || 0.8, 'Captive EF', rowNum),
          renewableElectricity: this.parseNumber(row['Renewable Electricity (kWh)'] || row['renewableElectricity'] || 0, 'Renewable', rowNum),
          notes: String(row['Notes'] || row['notes'] || '')
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async importFuel(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const month = this.parseNumber(row['Month'] || row['month'], 'Month', rowNum);
        const fuelName = String(row['Fuel Name'] || row['fuelName'] || '');
        
        if (!fuelName) {
          throw new Error('Fuel Name is required');
        }

        await FuelData.create({
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          facility: this.facilityId,
          month,
          fuelName,
          quantity: this.parseNumber(row['Quantity'] || row['quantity'], 'Quantity', rowNum),
          unit: String(row['Unit'] || row['unit'] || 'kg'),
          emissionFactor: this.parseNumber(row['Emission Factor (tCO2e/unit)'] || row['emissionFactor'] || 0, 'Emission Factor', rowNum),
          notes: String(row['Notes'] || row['notes'] || '')
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async importProduction(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const month = this.parseNumber(row['Month'] || row['month'], 'Month', rowNum);
        const productName = String(row['Product Name'] || row['productName'] || '');
        const cnCode = String(row['CN Code'] || row['cnCode'] || '');
        
        if (!productName) {
          throw new Error('Product Name is required');
        }

        // Find or create product
        let product = await Product.findOne({
          organisation: this.orgId,
          $or: [{ name: productName }, { cnCode }]
        });

        if (!product && cnCode) {
          product = await Product.create({
            organisation: this.orgId,
            name: productName,
            cnCode,
            unit: String(row['Unit'] || row['unit'] || 'tonnes'),
            isActive: true
          });
        }

        await ProductionData.create({
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          facility: this.facilityId,
          month,
          product: product?._id,
          productName,
          cnCode,
          quantityProduced: this.parseNumber(row['Quantity Produced'] || row['quantityProduced'], 'Quantity', rowNum),
          unit: String(row['Unit'] || row['unit'] || 'tonnes'),
          notes: String(row['Notes'] || row['notes'] || '')
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async importPrecursor(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const month = this.parseNumber(row['Month'] || row['month'], 'Month', rowNum);
        const supplierName = String(row['Supplier Name'] || row['supplierName'] || '');
        const materialName = String(row['Material Name'] || row['materialName'] || '');
        
        if (!supplierName || !materialName) {
          throw new Error('Supplier Name and Material Name are required');
        }

        // Find or reference supplier
        let supplier = await Supplier.findOne({
          organisation: this.orgId,
          name: supplierName
        });

        await PrecursorData.create({
          organisation: this.orgId,
          reportingPeriod: this.periodId,
          facility: this.facilityId,
          month,
          supplier: supplier?._id,
          supplierName,
          materialName,
          cnCode: String(row['CN Code'] || row['cnCode'] || ''),
          quantity: this.parseNumber(row['Quantity'] || row['quantity'], 'Quantity', rowNum),
          unit: String(row['Unit'] || row['unit'] || 'tonnes'),
          directEmissionFactor: this.parseNumber(row['Direct EF (tCO2e/t)'] || row['directEmissionFactor'] || 0, 'Direct EF', rowNum),
          indirectEmissionFactor: this.parseNumber(row['Indirect EF (tCO2e/t)'] || row['indirectEmissionFactor'] || 0, 'Indirect EF', rowNum),
          notes: String(row['Notes'] || row['notes'] || '')
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async importProducts(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const name = String(row['Product Name'] || row['name'] || '');
        const cnCode = String(row['CN Code (8 digits)'] || row['cnCode'] || '');
        
        if (!name) {
          throw new Error('Product Name is required');
        }

        // Check for duplicate
        const existing = await Product.findOne({
          organisation: this.orgId,
          $or: [{ name }, { cnCode }]
        });

        if (existing) {
          throw new Error(`Product already exists: ${existing.name}`);
        }

        await Product.create({
          organisation: this.orgId,
          name,
          cnCode,
          description: String(row['Description'] || row['description'] || ''),
          unit: String(row['Unit'] || row['unit'] || 'tonnes'),
          isActive: true
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  async importSuppliers(rows: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const name = String(row['Supplier Name'] || row['name'] || '');
        
        if (!name) {
          throw new Error('Supplier Name is required');
        }

        // Check for duplicate
        const existing = await Supplier.findOne({
          organisation: this.orgId,
          name
        });

        if (existing) {
          throw new Error(`Supplier already exists: ${name}`);
        }

        await Supplier.create({
          organisation: this.orgId,
          name,
          address: {
            countryCode: String(row['Country Code'] || row['countryCode'] || ''),
            street: String(row['Street Address'] || row['street'] || ''),
            city: String(row['City'] || row['city'] || ''),
            postalCode: String(row['Postal Code'] || row['postalCode'] || '')
          },
          contactEmail: String(row['Contact Email'] || row['contactEmail'] || ''),
          contactPhone: String(row['Contact Phone'] || row['contactPhone'] || ''),
          status: 'active'
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  private parseNumber(value: unknown, fieldName: string, row: number): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) {
      throw new Error(`Invalid number for ${fieldName} at row ${row}`);
    }
    return num;
  }
}

export default ImportService;

