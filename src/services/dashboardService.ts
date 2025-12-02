import mongoose from 'mongoose';
import Calculation from '../models/Calculation';
import { ElectricityData, FuelData, ProductionData, PrecursorData } from '../models/ActivityData';
import Product from '../models/Product';
import { Supplier, SupplierDeclaration } from '../models/Supplier';
import ReportingPeriod from '../models/ReportingPeriod';

interface DashboardSummary {
  totalEmissions: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  totalProduction: number;
  averageSEE: number;
  productCount: number;
  supplierCount: number;
}

interface ScopeBreakdown {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ProductSEE {
  productName: string;
  cnCode: string;
  production: number;
  seeTotal: number;
  seeDirect: number;
  seeIndirect: number;
  totalEmissions: number;
}

interface MonthlyTrend {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface SupplierContribution {
  supplierName: string;
  emissions: number;
  percentage: number;
}

interface EnergyMix {
  name: string;
  value: number;
  percentage: number;
}

interface QuarterComparison {
  quarter: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export class DashboardService {
  private orgId: mongoose.Types.ObjectId;

  constructor(organisationId: mongoose.Types.ObjectId) {
    this.orgId = organisationId;
  }

  async getSummary(reportingPeriodId?: string): Promise<DashboardSummary> {
    const filter: Record<string, unknown> = { organisation: this.orgId };
    if (reportingPeriodId) {
      filter.reportingPeriod = new mongoose.Types.ObjectId(reportingPeriodId);
    }

    // Get latest calculation
    const calculation = await Calculation.findOne(filter)
      .sort({ calculatedAt: -1 });

    // Get counts
    const [productCount, supplierCount] = await Promise.all([
      Product.countDocuments({ organisation: this.orgId, isActive: true }),
      Supplier.countDocuments({ organisation: this.orgId })
    ]);

    if (!calculation) {
      return {
        totalEmissions: 0,
        scope1Emissions: 0,
        scope2Emissions: 0,
        scope3Emissions: 0,
        totalProduction: 0,
        averageSEE: 0,
        productCount,
        supplierCount
      };
    }

    const averageSEE = calculation.products.length > 0
      ? calculation.products.reduce((sum, p) => sum + p.seeTotal, 0) / calculation.products.length
      : 0;

    return {
      totalEmissions: calculation.totalEmissions,
      scope1Emissions: calculation.totalScope1,
      scope2Emissions: calculation.totalScope2,
      scope3Emissions: calculation.totalScope3,
      totalProduction: calculation.totalProduction,
      averageSEE,
      productCount,
      supplierCount
    };
  }

  async getScopeBreakdown(reportingPeriodId?: string): Promise<ScopeBreakdown[]> {
    const filter: Record<string, unknown> = { organisation: this.orgId };
    if (reportingPeriodId) {
      filter.reportingPeriod = new mongoose.Types.ObjectId(reportingPeriodId);
    }

    const calculation = await Calculation.findOne(filter).sort({ calculatedAt: -1 });

    if (!calculation || calculation.totalEmissions === 0) {
      return [
        { name: 'Scope 1 (Direct)', value: 0, percentage: 0, color: '#f97316' },
        { name: 'Scope 2 (Indirect)', value: 0, percentage: 0, color: '#eab308' },
        { name: 'Scope 3 (Precursor)', value: 0, percentage: 0, color: '#3b82f6' }
      ];
    }

    const total = calculation.totalEmissions;
    return [
      {
        name: 'Scope 1 (Direct)',
        value: calculation.totalScope1,
        percentage: (calculation.totalScope1 / total) * 100,
        color: '#f97316'
      },
      {
        name: 'Scope 2 (Indirect)',
        value: calculation.totalScope2,
        percentage: (calculation.totalScope2 / total) * 100,
        color: '#eab308'
      },
      {
        name: 'Scope 3 (Precursor)',
        value: calculation.totalScope3,
        percentage: (calculation.totalScope3 / total) * 100,
        color: '#3b82f6'
      }
    ];
  }

  async getProductSEE(reportingPeriodId?: string): Promise<ProductSEE[]> {
    const filter: Record<string, unknown> = { organisation: this.orgId };
    if (reportingPeriodId) {
      filter.reportingPeriod = new mongoose.Types.ObjectId(reportingPeriodId);
    }

    const calculation = await Calculation.findOne(filter)
      .sort({ calculatedAt: -1 })
      .populate('products.product', 'name cnCode');

    if (!calculation) return [];

    return calculation.products.map(p => ({
      productName: p.productName,
      cnCode: p.cnCode,
      production: p.productionQuantity,
      seeTotal: p.seeTotal,
      seeDirect: p.seeDirect,
      seeIndirect: p.seeIndirect,
      totalEmissions: p.totalEmissions
    }));
  }

  async getMonthlyTrend(year: number): Promise<MonthlyTrend[]> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trends: MonthlyTrend[] = [];

    // Get all periods for the year
    const periods = await ReportingPeriod.find({
      organisation: this.orgId,
      year
    });

    // Get electricity and fuel data by month
    for (let i = 0; i < 12; i++) {
      const monthData = {
        month: months[i],
        scope1: 0,
        scope2: 0,
        scope3: 0,
        total: 0
      };

      // Aggregate fuel data for the month
      const fuelData = await FuelData.aggregate([
        {
          $match: {
            organisation: this.orgId,
            month: i + 1
          }
        },
        {
          $group: {
            _id: null,
            totalEmissions: { $sum: { $multiply: ['$quantity', { $ifNull: ['$emissionFactor', 0] }] } }
          }
        }
      ]);

      if (fuelData.length > 0) {
        monthData.scope1 = fuelData[0].totalEmissions || 0;
      }

      // Aggregate electricity data for the month
      const elecData = await ElectricityData.aggregate([
        {
          $match: {
            organisation: this.orgId,
            month: i + 1
          }
        },
        {
          $group: {
            _id: null,
            gridEmissions: { 
              $sum: { 
                $multiply: [
                  { $divide: ['$gridElectricity', 1000] },
                  { $ifNull: ['$gridEmissionFactor', 0.716] }
                ] 
              } 
            },
            captiveEmissions: { 
              $sum: { 
                $multiply: [
                  { $divide: ['$captiveElectricity', 1000] },
                  { $ifNull: ['$captiveEmissionFactor', 0.8] }
                ] 
              } 
            }
          }
        }
      ]);

      if (elecData.length > 0) {
        monthData.scope2 = (elecData[0].gridEmissions || 0) + (elecData[0].captiveEmissions || 0);
      }

      // Aggregate precursor data for the month (simplified)
      const precursorData = await PrecursorData.aggregate([
        {
          $match: {
            organisation: this.orgId,
            month: i + 1
          }
        },
        {
          $group: {
            _id: null,
            totalEmissions: { 
              $sum: { 
                $multiply: [
                  '$quantity',
                  { $add: [
                    { $ifNull: ['$directEmissionFactor', 0] },
                    { $ifNull: ['$indirectEmissionFactor', 0] }
                  ]}
                ] 
              } 
            }
          }
        }
      ]);

      if (precursorData.length > 0) {
        monthData.scope3 = precursorData[0].totalEmissions || 0;
      }

      monthData.total = monthData.scope1 + monthData.scope2 + monthData.scope3;
      trends.push(monthData);
    }

    return trends;
  }

  async getSupplierContribution(reportingPeriodId?: string): Promise<SupplierContribution[]> {
    const matchStage: Record<string, unknown> = { organisation: this.orgId };
    if (reportingPeriodId) {
      matchStage.reportingPeriod = new mongoose.Types.ObjectId(reportingPeriodId);
    }

    const supplierEmissions = await PrecursorData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$supplierName',
          emissions: {
            $sum: {
              $multiply: [
                '$quantity',
                { $add: [
                  { $ifNull: ['$directEmissionFactor', 0] },
                  { $ifNull: ['$indirectEmissionFactor', 0] }
                ]}
              ]
            }
          }
        }
      },
      { $sort: { emissions: -1 } },
      { $limit: 10 }
    ]);

    const totalEmissions = supplierEmissions.reduce((sum, s) => sum + s.emissions, 0);

    return supplierEmissions.map(s => ({
      supplierName: s._id || 'Unknown',
      emissions: s.emissions,
      percentage: totalEmissions > 0 ? (s.emissions / totalEmissions) * 100 : 0
    }));
  }

  async getEnergyMix(reportingPeriodId?: string): Promise<EnergyMix[]> {
    const matchStage: Record<string, unknown> = { organisation: this.orgId };
    if (reportingPeriodId) {
      matchStage.reportingPeriod = new mongoose.Types.ObjectId(reportingPeriodId);
    }

    const elecData = await ElectricityData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          grid: { $sum: '$gridElectricity' },
          captive: { $sum: '$captiveElectricity' },
          renewable: { $sum: '$renewableElectricity' }
        }
      }
    ]);

    if (elecData.length === 0) {
      return [
        { name: 'Grid', value: 0, percentage: 0 },
        { name: 'Captive/DG', value: 0, percentage: 0 },
        { name: 'Renewable', value: 0, percentage: 0 }
      ];
    }

    const data = elecData[0];
    const total = data.grid + data.captive + data.renewable;

    return [
      { name: 'Grid', value: data.grid, percentage: total > 0 ? (data.grid / total) * 100 : 0 },
      { name: 'Captive/DG', value: data.captive, percentage: total > 0 ? (data.captive / total) * 100 : 0 },
      { name: 'Renewable', value: data.renewable, percentage: total > 0 ? (data.renewable / total) * 100 : 0 }
    ];
  }

  async getQuarterComparison(year: number): Promise<QuarterComparison[]> {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const comparisons: QuarterComparison[] = [];

    for (const quarter of quarters) {
      const period = await ReportingPeriod.findOne({
        organisation: this.orgId,
        year,
        quarter
      });

      if (!period) {
        comparisons.push({
          quarter,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0
        });
        continue;
      }

      const calculation = await Calculation.findOne({
        organisation: this.orgId,
        reportingPeriod: period._id
      }).sort({ calculatedAt: -1 });

      if (calculation) {
        comparisons.push({
          quarter,
          scope1: calculation.totalScope1,
          scope2: calculation.totalScope2,
          scope3: calculation.totalScope3,
          total: calculation.totalEmissions
        });
      } else {
        comparisons.push({
          quarter,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0
        });
      }
    }

    return comparisons;
  }
}

export default DashboardService;

