import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Template definitions with columns
const TEMPLATES = {
  electricity: {
    name: 'Electricity Consumption Template',
    columns: [
      { header: 'Month', key: 'month', width: 15, example: '1-12' },
      { header: 'Grid Electricity (kWh)', key: 'gridElectricity', width: 25, example: '50000' },
      { header: 'Grid Emission Factor', key: 'gridEmissionFactor', width: 25, example: '0.716' },
      { header: 'Captive/DG Electricity (kWh)', key: 'captiveElectricity', width: 30, example: '10000' },
      { header: 'Captive Emission Factor', key: 'captiveEmissionFactor', width: 25, example: '0.8' },
      { header: 'Renewable Electricity (kWh)', key: 'renewableElectricity', width: 28, example: '5000' },
      { header: 'Notes', key: 'notes', width: 30, example: 'Optional notes' }
    ]
  },
  fuel: {
    name: 'Fuel Consumption Template',
    columns: [
      { header: 'Month', key: 'month', width: 15, example: '1-12' },
      { header: 'Fuel Name', key: 'fuelName', width: 20, example: 'Natural Gas' },
      { header: 'Quantity', key: 'quantity', width: 15, example: '1000' },
      { header: 'Unit', key: 'unit', width: 15, example: 'kg/litre/m3' },
      { header: 'Emission Factor (tCO2e/unit)', key: 'emissionFactor', width: 30, example: '2.75' },
      { header: 'Notes', key: 'notes', width: 30, example: 'Optional notes' }
    ]
  },
  production: {
    name: 'Production Data Template',
    columns: [
      { header: 'Month', key: 'month', width: 15, example: '1-12' },
      { header: 'Product Name', key: 'productName', width: 25, example: 'Steel Wire Rod' },
      { header: 'CN Code', key: 'cnCode', width: 15, example: '72139110' },
      { header: 'Quantity Produced', key: 'quantityProduced', width: 20, example: '500' },
      { header: 'Unit', key: 'unit', width: 15, example: 'tonnes' },
      { header: 'Notes', key: 'notes', width: 30, example: 'Optional notes' }
    ]
  },
  precursor: {
    name: 'Precursor/Raw Material Template',
    columns: [
      { header: 'Month', key: 'month', width: 15, example: '1-12' },
      { header: 'Supplier Name', key: 'supplierName', width: 25, example: 'ABC Steel Co.' },
      { header: 'Material Name', key: 'materialName', width: 25, example: 'Iron Ore' },
      { header: 'CN Code', key: 'cnCode', width: 15, example: '26011100' },
      { header: 'Quantity', key: 'quantity', width: 15, example: '1000' },
      { header: 'Unit', key: 'unit', width: 15, example: 'tonnes' },
      { header: 'Direct EF (tCO2e/t)', key: 'directEmissionFactor', width: 22, example: '1.5' },
      { header: 'Indirect EF (tCO2e/t)', key: 'indirectEmissionFactor', width: 24, example: '0.3' },
      { header: 'Notes', key: 'notes', width: 30, example: 'Optional notes' }
    ]
  },
  products: {
    name: 'Products Import Template',
    columns: [
      { header: 'Product Name', key: 'name', width: 30, example: 'Steel Wire Rod' },
      { header: 'CN Code (8 digits)', key: 'cnCode', width: 20, example: '72139110' },
      { header: 'Description', key: 'description', width: 40, example: 'Hot rolled steel wire rod' },
      { header: 'Unit', key: 'unit', width: 15, example: 'tonnes' }
    ]
  },
  suppliers: {
    name: 'Suppliers Import Template',
    columns: [
      { header: 'Supplier Name', key: 'name', width: 30, example: 'ABC Steel Co.' },
      { header: 'Country Code', key: 'countryCode', width: 15, example: 'IN' },
      { header: 'Contact Email', key: 'contactEmail', width: 30, example: 'supplier@example.com' },
      { header: 'Contact Phone', key: 'contactPhone', width: 20, example: '+91-9876543210' },
      { header: 'Street Address', key: 'street', width: 30, example: '123 Industrial Area' },
      { header: 'City', key: 'city', width: 20, example: 'Mumbai' },
      { header: 'Postal Code', key: 'postalCode', width: 15, example: '400001' }
    ]
  }
};

// Generate CSV content
function generateCSV(template: typeof TEMPLATES[keyof typeof TEMPLATES]): string {
  const headers = template.columns.map(c => c.header).join(',');
  const examples = template.columns.map(c => c.example).join(',');
  return `${headers}\n${examples}`;
}

// @route   GET /api/templates
// @desc    Get list of available templates
// @access  Private
router.get('/', (req: AuthRequest, res: Response) => {
  const templateList = Object.entries(TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    columns: value.columns.map(c => ({ header: c.header, key: c.key }))
  }));

  res.json({ success: true, data: templateList });
});

// @route   GET /api/templates/:type
// @desc    Download template as CSV
// @access  Private
router.get('/:type', (req: AuthRequest, res: Response) => {
  const templateType = req.params.type as keyof typeof TEMPLATES;
  const template = TEMPLATES[templateType];

  if (!template) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  const csvContent = generateCSV(template);
  const fileName = `${templateType}_template.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csvContent);
});

// @route   GET /api/templates/:type/json
// @desc    Get template structure as JSON
// @access  Private
router.get('/:type/json', (req: AuthRequest, res: Response) => {
  const templateType = req.params.type as keyof typeof TEMPLATES;
  const template = TEMPLATES[templateType];

  if (!template) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      name: template.name,
      columns: template.columns
    }
  });
});

export default router;

