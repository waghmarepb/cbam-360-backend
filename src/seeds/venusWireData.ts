import mongoose from 'mongoose';
import Organisation, { OrganisationType } from '../models/Organisation';
import User, { UserRole } from '../models/User';
import Facility from '../models/Facility';
import Product from '../models/Product';
import ReportingPeriod, { Quarter, ReportingPeriodStatus } from '../models/ReportingPeriod';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import Supplier, { SupplierDeclaration, DeclarationStatus } from '../models/Supplier';
import Calculation from '../models/Calculation';

/**
 * Seed data based on Venus Wire Industries Pvt. Ltd. CBAM Report
 * Reporting Period: October 2023 - December 2023
 * 
 * Reference: CBAM Report for Venus Wire Industries Pvt. Ltd.
 * Total Embedded Emissions: 17,573.952 tCO₂e
 * SEE: 3.415 tCO₂e/t of Stainless Steel Wire
 */

export async function seedVenusWireData(): Promise<void> {
  try {
    // Check if Venus Wire already exists
    const existingOrg = await Organisation.findOne({ name: 'Venus Wire Industries Pvt. Ltd.' });
    if (existingOrg) {
      // Check if the admin user exists for this organisation
      const existingUser = await User.findOne({ email: 'admin@venuswire.com' });
      if (!existingUser) {
        // Create admin user if missing
        console.log('🔧 Creating missing admin user for Venus Wire Industries...');
        await User.create({
          email: 'admin@venuswire.com',
          password: 'VenusWire@2024',
          firstName: 'Rajesh',
          lastName: 'Sharma',
          role: UserRole.ADMIN,
          organisation: existingOrg._id,
          isActive: true
        });
        console.log('✅ Admin user created: admin@venuswire.com / VenusWire@2024');
      } else {
        console.log('⏭️  Venus Wire Industries already exists, skipping seed');
      }
      return;
    }

    console.log('🏭 Seeding Venus Wire Industries data from CBAM Report...');

    // 1. Create Organisation
    const organisation = await Organisation.create({
      name: 'Venus Wire Industries Pvt. Ltd.',
      type: OrganisationType.NON_EU_PRODUCER,
      address: {
        street: 'MIDC Industrial Area',
        city: 'Raigad',
        state: 'Maharashtra',
        postalCode: '410222',
        country: 'India',
        countryCode: 'IN'
      },
      contactEmail: 'cbam@venuswire.com',
      contactPhone: '+91-22-12345678',
      website: 'https://www.venuswire.com'
    });

    // 2. Create Admin User (password is auto-hashed by pre-save hook)
    const adminUser = await User.create({
      email: 'admin@venuswire.com',
      password: 'VenusWire@2024',
      firstName: 'Rajesh',
      lastName: 'Sharma',
      role: UserRole.ADMIN,
      organisation: organisation._id,
      isActive: true
    });

    // 3. Create Facility (Manufacturing Plant at Raigad)
    const facility = await Facility.create({
      organisation: organisation._id,
      name: 'Raigad Manufacturing Facility',
      address: {
        street: 'Plot No. 45, MIDC Industrial Area',
        city: 'Raigad',
        state: 'Maharashtra',
        postalCode: '410222',
        countryCode: 'IN'
      },
      installationId: 'VWIPVTL-RAIGAD-001',
      productionCapacity: 25000, // tonnes per year
      isActive: true
    });

    // 4. Create Products (based on CBAM Report Table 3)
    const products = await Product.create([
      {
        organisation: organisation._id,
        name: 'Stainless Steel Wire',
        cnCode: '72230091',
        description: 'Stainless steel wire in austenitic, ferritic, martensitic and precipitation hardening grades. Size range: 0.70mm to 22mm.',
        unit: 'tonnes',
        isActive: true
      },
      {
        organisation: organisation._id,
        name: 'Stainless Steel Coarse Wire',
        cnCode: '72230019',
        description: 'Stainless Steel Coarse Wires in size range 0.70mm to 22mm (0.028" - 0.870")',
        unit: 'tonnes',
        isActive: true
      },
      {
        organisation: organisation._id,
        name: 'TIG Welding Wire',
        cnCode: '72230091',
        description: 'TIG wires in coil and cut lengths, size range 0.80mm to 6.00mm, AWS SFA 5.9 standard',
        unit: 'tonnes',
        isActive: true
      },
      {
        organisation: organisation._id,
        name: 'MIG Welding Wire',
        cnCode: '72230091',
        description: 'MIG welding wires for various stainless steel applications',
        unit: 'tonnes',
        isActive: true
      },
      {
        organisation: organisation._id,
        name: 'Submerged Arc Welding Wire',
        cnCode: '72230091',
        description: 'SUB ARC wires for industrial welding applications',
        unit: 'tonnes',
        isActive: true
      }
    ]);

    // 5. Create Reporting Period (Q4 2023 from CBAM Report)
    const reportingPeriod = await ReportingPeriod.create({
      organisation: organisation._id,
      year: 2023,
      quarter: Quarter.Q4,
      startDate: new Date('2023-10-01'),
      endDate: new Date('2023-12-31'),
      status: ReportingPeriodStatus.SUBMITTED,
      submittedAt: new Date('2024-01-15'),
      submittedBy: adminUser._id
    });

    // 6. Create Suppliers (from CBAM Report Table 7)
    const suppliers = await Supplier.create([
      {
        organisation: organisation._id,
        name: 'Mukand Limited',
        contactEmail: 'exports@mukand.com',
        countryCode: 'IN',
        address: {
          city: 'Thane',
          countryCode: 'IN'
        },
        products: ['Stainless Steel Wire Rod', 'SS Bars'],
        isActive: true,
        hasProvidedData: true
      },
      {
        organisation: organisation._id,
        name: 'Sunflag Steel',
        contactEmail: 'sales@sunflagsteel.com',
        countryCode: 'IN',
        address: {
          city: 'Bhandara',
          countryCode: 'IN'
        },
        products: ['Stainless Steel Billets'],
        isActive: true,
        hasProvidedData: true
      },
      {
        organisation: organisation._id,
        name: 'Advance Power Pvt Ltd',
        contactEmail: 'info@advancepower.in',
        countryCode: 'IN',
        address: {
          city: 'Mumbai',
          countryCode: 'IN'
        },
        products: ['SS Wire Rod'],
        isActive: true,
        hasProvidedData: false // Using default values
      },
      {
        organisation: organisation._id,
        name: 'Chandan Steel Ltd',
        contactEmail: 'sales@chandansteel.com',
        countryCode: 'IN',
        address: {
          city: 'Raipur',
          countryCode: 'IN'
        },
        products: ['SS Wire Rod', 'SS Bars'],
        isActive: true,
        hasProvidedData: false // Using default values
      }
    ]);

    // 7. Create Supplier Declarations (emission factors from CBAM Report)
    await SupplierDeclaration.create([
      {
        supplier: suppliers[0]._id, // Mukand Limited
        organisation: organisation._id,
        reportingPeriod: reportingPeriod._id,
        productName: 'SS Wire Rod (7221)',
        cnCode: '72210000',
        quantity: 2423.082,
        unit: 'tonnes',
        directEmissionFactor: 0.709,
        indirectEmissionFactor: 0.937,
        totalEmissionFactor: 1.646,
        calculationMethod: 'actual',
        status: DeclarationStatus.VERIFIED,
        verifiedAt: new Date('2024-01-10')
      },
      {
        supplier: suppliers[1]._id, // Sunflag Steel
        organisation: organisation._id,
        reportingPeriod: reportingPeriod._id,
        productName: 'SS Billets (7221)',
        cnCode: '72210000',
        quantity: 469.680,
        unit: 'tonnes',
        directEmissionFactor: 2.096,
        indirectEmissionFactor: 0.369,
        totalEmissionFactor: 2.465,
        calculationMethod: 'actual',
        status: DeclarationStatus.VERIFIED,
        verifiedAt: new Date('2024-01-10')
      },
      {
        supplier: suppliers[2]._id, // Advance Power
        organisation: organisation._id,
        reportingPeriod: reportingPeriod._id,
        productName: 'SS Wire Rod (7223)',
        cnCode: '72230000',
        quantity: 1.040,
        unit: 'tonnes',
        directEmissionFactor: 2.13, // Default value
        indirectEmissionFactor: 2.36, // Default value
        totalEmissionFactor: 4.49,
        calculationMethod: 'default',
        status: DeclarationStatus.PENDING
      },
      {
        supplier: suppliers[3]._id, // Chandan Steel
        organisation: organisation._id,
        reportingPeriod: reportingPeriod._id,
        productName: 'SS Wire Rod (7221)',
        cnCode: '72210000',
        quantity: 2418.217,
        unit: 'tonnes',
        directEmissionFactor: 2.14, // Default value
        indirectEmissionFactor: 2.17, // Default value
        totalEmissionFactor: 4.31,
        calculationMethod: 'default',
        status: DeclarationStatus.PENDING
      }
    ]);

    // 8. Create Electricity Data (from CBAM Report Table 6)
    // Total indirect emissions from electricity: 1,477.317 tCO2e
    // Using India grid emission factor: 0.716 tCO2e/MWh
    await ElectricityData.create([
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10, // October 2023
        gridElectricity: 690000, // kWh (estimated ~690 MWh)
        renewableElectricity: 0,
        gridEmissionFactor: 0.716,
        renewableEmissionFactor: 0,
        source: 'MSEDCL Grid'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11, // November 2023
        gridElectricity: 720000, // kWh
        renewableElectricity: 0,
        gridEmissionFactor: 0.716,
        renewableEmissionFactor: 0,
        source: 'MSEDCL Grid'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12, // December 2023
        gridElectricity: 654000, // kWh
        renewableElectricity: 0,
        gridEmissionFactor: 0.716,
        renewableEmissionFactor: 0,
        source: 'MSEDCL Grid'
      }
    ]);

    // 9. Create Fuel Data (from CBAM Report Table 5)
    // Total direct emissions: 523.295 tCO2e
    await FuelData.create([
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10,
        fuelName: 'Propane (LPG)',
        fuelType: 'lpg',
        quantity: 52.5, // tonnes
        unit: 'tonnes',
        emissionFactor: 2.98463, // tCO2e/t from CBAM Report
        purpose: 'Heat treatment furnaces'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11,
        fuelName: 'Propane (LPG)',
        fuelType: 'lpg',
        quantity: 58.2,
        unit: 'tonnes',
        emissionFactor: 2.98463,
        purpose: 'Heat treatment furnaces'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12,
        fuelName: 'Propane (LPG)',
        fuelType: 'lpg',
        quantity: 55.8,
        unit: 'tonnes',
        emissionFactor: 2.98463,
        purpose: 'Heat treatment furnaces'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10,
        fuelName: 'Diesel',
        fuelType: 'diesel',
        quantity: 2500, // litres
        unit: 'litres',
        emissionFactor: 0.002708, // tCO2e/L
        purpose: 'DG sets and material handling'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11,
        fuelName: 'Diesel',
        fuelType: 'diesel',
        quantity: 2800,
        unit: 'litres',
        emissionFactor: 0.002708,
        purpose: 'DG sets and material handling'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12,
        fuelName: 'Diesel',
        fuelType: 'diesel',
        quantity: 2650,
        unit: 'litres',
        emissionFactor: 0.002708,
        purpose: 'DG sets and material handling'
      }
    ]);

    // 10. Create Precursor Data (from CBAM Report Table 7)
    await PrecursorData.create([
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10,
        supplierName: 'Mukand Limited',
        materialName: 'SS Wire Rod',
        cnCode: '72210000',
        quantity: 807.694, // ~1/3 of total quarterly
        unit: 'tonnes',
        directEmissionFactor: 0.709,
        indirectEmissionFactor: 0.937,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11,
        supplierName: 'Mukand Limited',
        materialName: 'SS Wire Rod',
        cnCode: '72210000',
        quantity: 807.694,
        unit: 'tonnes',
        directEmissionFactor: 0.709,
        indirectEmissionFactor: 0.937,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12,
        supplierName: 'Mukand Limited',
        materialName: 'SS Wire Rod',
        cnCode: '72210000',
        quantity: 807.694,
        unit: 'tonnes',
        directEmissionFactor: 0.709,
        indirectEmissionFactor: 0.937,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10,
        supplierName: 'Sunflag Steel',
        materialName: 'SS Billets',
        cnCode: '72210000',
        quantity: 156.56,
        unit: 'tonnes',
        directEmissionFactor: 2.096,
        indirectEmissionFactor: 0.369,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11,
        supplierName: 'Sunflag Steel',
        materialName: 'SS Billets',
        cnCode: '72210000',
        quantity: 156.56,
        unit: 'tonnes',
        directEmissionFactor: 2.096,
        indirectEmissionFactor: 0.369,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12,
        supplierName: 'Sunflag Steel',
        materialName: 'SS Billets',
        cnCode: '72210000',
        quantity: 156.56,
        unit: 'tonnes',
        directEmissionFactor: 2.096,
        indirectEmissionFactor: 0.369,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 10,
        supplierName: 'Chandan Steel Ltd',
        materialName: 'SS Wire Rod (Default)',
        cnCode: '72210000',
        quantity: 806.072,
        unit: 'tonnes',
        directEmissionFactor: 2.14, // Default value
        indirectEmissionFactor: 2.17, // Default value
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 11,
        supplierName: 'Chandan Steel Ltd',
        materialName: 'SS Wire Rod (Default)',
        cnCode: '72210000',
        quantity: 806.072,
        unit: 'tonnes',
        directEmissionFactor: 2.14,
        indirectEmissionFactor: 2.17,
        countryOfOrigin: 'IN'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        month: 12,
        supplierName: 'Chandan Steel Ltd',
        materialName: 'SS Wire Rod (Default)',
        cnCode: '72210000',
        quantity: 806.073,
        unit: 'tonnes',
        directEmissionFactor: 2.14,
        indirectEmissionFactor: 2.17,
        countryOfOrigin: 'IN'
      }
    ]);

    // 11. Create Production Data (calculated from SEE)
    // Total production ≈ 5,148 tonnes based on emissions / SEE
    const mainProduct = products[0]; // Stainless Steel Wire
    await ProductionData.create([
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        product: mainProduct._id,
        productName: 'Stainless Steel Wire',
        cnCode: '72230091',
        month: 10,
        quantityProduced: 1716, // tonnes
        unit: 'tonnes'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        product: mainProduct._id,
        productName: 'Stainless Steel Wire',
        cnCode: '72230091',
        month: 11,
        quantityProduced: 1716,
        unit: 'tonnes'
      },
      {
        organisation: organisation._id,
        facility: facility._id,
        reportingPeriod: reportingPeriod._id,
        product: mainProduct._id,
        productName: 'Stainless Steel Wire',
        cnCode: '72230091',
        month: 12,
        quantityProduced: 1716,
        unit: 'tonnes'
      }
    ]);

    // 12. Create Calculation Result (from CBAM Report conclusions)
    await Calculation.create({
      organisation: organisation._id,
      reportingPeriod: reportingPeriod._id,
      calculatedBy: adminUser._id,
      calculatedAt: new Date('2024-01-12'),
      status: 'completed',
      totalScope1: 523.295, // Direct emissions from installation
      totalScope2: 1477.318, // Indirect emissions from electricity
      totalScope3: 15573.339, // Precursor emissions (7879.614 + 7693.725)
      totalEmissions: 17573.952, // Total embedded emissions
      totalProduction: 5148,
      products: [
        {
          productId: mainProduct._id,
          productName: 'Stainless Steel Wire',
          cnCode: '72230091',
          productionQuantity: 5148,
          scope1Emissions: 523.295,
          scope2Emissions: 1477.318,
          scope3Emissions: 15573.339,
          totalEmissions: 17573.952,
          seeDirect: 1.633, // tCO2e/t
          seeIndirect: 1.782, // tCO2e/t
          seeTotal: 3.415 // tCO2e/t
        }
      ],
      metadata: {
        calculationMethod: 'actual',
        emissionFactorSource: 'IPCC 2006, CEA Version 19',
        notes: 'Based on CBAM Report for Q4 2023. Precursors contribute >89% of total embedded emissions.'
      }
    });

    console.log('✅ Venus Wire Industries data seeded successfully!');
    console.log(`   📧 Login: admin@venuswire.com / VenusWire@2024`);
    console.log(`   🏭 Organisation: Venus Wire Industries Pvt. Ltd.`);
    console.log(`   📊 Reporting Period: Q4 2023 (Oct-Dec)`);
    console.log(`   🌍 Total Emissions: 17,573.952 tCO₂e`);
    console.log(`   📈 SEE: 3.415 tCO₂e/t of Stainless Steel Wire`);

  } catch (error) {
    console.error('❌ Error seeding Venus Wire data:', error);
    throw error;
  }
}

export default seedVenusWireData;

