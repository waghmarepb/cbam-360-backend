import EmissionFactor, { EmissionFactorType } from '../models/EmissionFactor';

// Fuel Emission Factors (IPCC 2006 / GHG Protocol)
const fuelFactors = [
  // Solid Fuels
  { name: 'Anthracite Coal', code: 'COAL_ANTH', category: 'solid', emissionFactor: 2.6574, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Bituminous Coal', code: 'COAL_BIT', category: 'solid', emissionFactor: 2.4218, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Sub-bituminous Coal', code: 'COAL_SUB', category: 'solid', emissionFactor: 1.8865, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Lignite', code: 'COAL_LIG', category: 'solid', emissionFactor: 1.1506, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Coke', code: 'COKE', category: 'solid', emissionFactor: 3.1946, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Petroleum Coke', code: 'PET_COKE', category: 'solid', emissionFactor: 3.1906, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  
  // Liquid Fuels
  { name: 'Diesel Oil', code: 'DIESEL', category: 'liquid', emissionFactor: 3.169, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Diesel Oil (per litre)', code: 'DIESEL_L', category: 'liquid', emissionFactor: 0.002676, unit: 'tCO2e/L', sourceUnit: 'litre', source: 'IPCC 2006' },
  { name: 'Petrol/Gasoline', code: 'PETROL', category: 'liquid', emissionFactor: 3.067, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Heavy Fuel Oil (HFO)', code: 'HFO', category: 'liquid', emissionFactor: 3.114, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Light Fuel Oil (LFO)', code: 'LFO', category: 'liquid', emissionFactor: 3.128, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Kerosene', code: 'KEROSENE', category: 'liquid', emissionFactor: 3.128, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'LPG', code: 'LPG', category: 'liquid', emissionFactor: 2.983, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Naphtha', code: 'NAPHTHA', category: 'liquid', emissionFactor: 3.0779, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  
  // Gaseous Fuels
  { name: 'Natural Gas', code: 'NAT_GAS', category: 'gaseous', emissionFactor: 2.693, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Natural Gas (per m³)', code: 'NAT_GAS_M3', category: 'gaseous', emissionFactor: 0.00202, unit: 'tCO2e/m³', sourceUnit: 'm³', source: 'IPCC 2006' },
  { name: 'Propane', code: 'PROPANE', category: 'gaseous', emissionFactor: 2.98463, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Butane', code: 'BUTANE', category: 'gaseous', emissionFactor: 2.964, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Refinery Gas', code: 'REF_GAS', category: 'gaseous', emissionFactor: 2.632, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Blast Furnace Gas', code: 'BF_GAS', category: 'gaseous', emissionFactor: 0.912, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
  { name: 'Coke Oven Gas', code: 'COG', category: 'gaseous', emissionFactor: 1.564, unit: 'tCO2e/t', sourceUnit: 'tonne', source: 'IPCC 2006' },
];

// Country-wise Grid Electricity Emission Factors (IEA 2023)
const electricityFactors = [
  // Major CBAM-relevant countries
  { name: 'India Grid Average', countryCode: 'IN', emissionFactor: 0.716, unit: 'tCO2e/MWh', source: 'CEA India 2023', year: 2023 },
  { name: 'China Grid Average', countryCode: 'CN', emissionFactor: 0.555, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'USA Grid Average', countryCode: 'US', emissionFactor: 0.386, unit: 'tCO2e/MWh', source: 'EPA eGRID 2023', year: 2023 },
  { name: 'Russia Grid Average', countryCode: 'RU', emissionFactor: 0.329, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Japan Grid Average', countryCode: 'JP', emissionFactor: 0.462, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'South Korea Grid Average', countryCode: 'KR', emissionFactor: 0.424, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Turkey Grid Average', countryCode: 'TR', emissionFactor: 0.438, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Brazil Grid Average', countryCode: 'BR', emissionFactor: 0.075, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'South Africa Grid Average', countryCode: 'ZA', emissionFactor: 0.928, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Indonesia Grid Average', countryCode: 'ID', emissionFactor: 0.761, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Vietnam Grid Average', countryCode: 'VN', emissionFactor: 0.516, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Thailand Grid Average', countryCode: 'TH', emissionFactor: 0.466, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Malaysia Grid Average', countryCode: 'MY', emissionFactor: 0.585, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Taiwan Grid Average', countryCode: 'TW', emissionFactor: 0.502, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Mexico Grid Average', countryCode: 'MX', emissionFactor: 0.431, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Egypt Grid Average', countryCode: 'EG', emissionFactor: 0.455, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Pakistan Grid Average', countryCode: 'PK', emissionFactor: 0.423, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Bangladesh Grid Average', countryCode: 'BD', emissionFactor: 0.528, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'UAE Grid Average', countryCode: 'AE', emissionFactor: 0.418, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Saudi Arabia Grid Average', countryCode: 'SA', emissionFactor: 0.592, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  
  // EU Countries (for reference/comparison)
  { name: 'Germany Grid Average', countryCode: 'DE', emissionFactor: 0.350, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'France Grid Average', countryCode: 'FR', emissionFactor: 0.052, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Italy Grid Average', countryCode: 'IT', emissionFactor: 0.315, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Spain Grid Average', countryCode: 'ES', emissionFactor: 0.160, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Poland Grid Average', countryCode: 'PL', emissionFactor: 0.635, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Netherlands Grid Average', countryCode: 'NL', emissionFactor: 0.328, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Belgium Grid Average', countryCode: 'BE', emissionFactor: 0.142, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  
  // UK
  { name: 'UK Grid Average', countryCode: 'GB', emissionFactor: 0.207, unit: 'tCO2e/MWh', source: 'DEFRA 2023', year: 2023 },
  
  // Other
  { name: 'Australia Grid Average', countryCode: 'AU', emissionFactor: 0.656, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
  { name: 'Canada Grid Average', countryCode: 'CA', emissionFactor: 0.120, unit: 'tCO2e/MWh', source: 'IEA 2023', year: 2023 },
];

// CBAM Default Values for Precursors (EU CBAM Regulation)
const defaultFactors = [
  // Iron and Steel defaults
  { name: 'Pig Iron Default', category: 'iron_steel', cnCode: '7201', emissionFactor: 1.808, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Ferro-alloys Default', category: 'iron_steel', cnCode: '7202', emissionFactor: 5.232, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'DRI/Sponge Iron Default', category: 'iron_steel', cnCode: '7203', emissionFactor: 1.214, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Iron/Steel Scrap Default', category: 'iron_steel', cnCode: '7204', emissionFactor: 0.074, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Iron Ingots Default', category: 'iron_steel', cnCode: '7206', emissionFactor: 2.144, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Semi-finished Steel Default', category: 'iron_steel', cnCode: '7207', emissionFactor: 2.192, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Hot-rolled Flat Steel Default', category: 'iron_steel', cnCode: '7208', emissionFactor: 2.302, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Cold-rolled Flat Steel Default', category: 'iron_steel', cnCode: '7209', emissionFactor: 2.612, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Coated Steel Default', category: 'iron_steel', cnCode: '7210', emissionFactor: 2.826, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Stainless Steel Ingots Default', category: 'iron_steel', cnCode: '7218', emissionFactor: 5.090, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Stainless Steel Wire Default', category: 'iron_steel', cnCode: '7223', emissionFactor: 6.143, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  
  // Aluminium defaults
  { name: 'Unwrought Aluminium Default', category: 'aluminium', cnCode: '7601', emissionFactor: 16.296, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Aluminium Bars/Rods Default', category: 'aluminium', cnCode: '7604', emissionFactor: 17.124, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Aluminium Wire Default', category: 'aluminium', cnCode: '7605', emissionFactor: 17.124, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Aluminium Plates/Sheets Default', category: 'aluminium', cnCode: '7606', emissionFactor: 17.482, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Aluminium Foil Default', category: 'aluminium', cnCode: '7607', emissionFactor: 18.198, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  
  // Cement defaults
  { name: 'Portland Cement Default', category: 'cement', cnCode: '2523', emissionFactor: 0.834, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Clinker Default', category: 'cement', cnCode: '2523', emissionFactor: 0.912, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  
  // Fertilizers defaults
  { name: 'Urea Default', category: 'fertilizers', cnCode: '3102', emissionFactor: 2.128, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Ammonium Nitrate Default', category: 'fertilizers', cnCode: '3102', emissionFactor: 6.712, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Ammonia Default', category: 'fertilizers', cnCode: '2814', emissionFactor: 2.508, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  
  // Hydrogen
  { name: 'Hydrogen (Grey) Default', category: 'hydrogen', cnCode: '2804', emissionFactor: 12.0, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
  { name: 'Hydrogen (Blue) Default', category: 'hydrogen', cnCode: '2804', emissionFactor: 4.0, unit: 'tCO2e/t', source: 'EU CBAM Default 2023' },
];

export async function seedEmissionFactors(): Promise<void> {
  try {
    const count = await EmissionFactor.countDocuments();
    
    if (count > 0) {
      console.log(`Emission factors already seeded (${count} records)`);
      return;
    }

    // Seed fuel factors
    const fuelDocs = fuelFactors.map(f => ({
      ...f,
      type: EmissionFactorType.FUEL,
      isDefault: true,
      isActive: true
    }));

    // Seed electricity factors
    const electricityDocs = electricityFactors.map(e => ({
      ...e,
      type: EmissionFactorType.ELECTRICITY,
      sourceUnit: 'MWh',
      isDefault: true,
      isActive: true
    }));

    // Seed default precursor factors
    const defaultDocs = defaultFactors.map(d => ({
      ...d,
      type: EmissionFactorType.DEFAULT,
      sourceUnit: 'tonne',
      isDefault: true,
      isActive: true
    }));

    await EmissionFactor.insertMany([...fuelDocs, ...electricityDocs, ...defaultDocs]);
    console.log(`✅ Seeded ${fuelDocs.length} fuel factors, ${electricityDocs.length} electricity factors, ${defaultDocs.length} default factors`);
  } catch (error) {
    console.error('Error seeding emission factors:', error);
  }
}

export default seedEmissionFactors;

