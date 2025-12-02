import mongoose from 'mongoose';
import Calculation, { ICalculation, IProductCalculation } from '../models/Calculation';
import Organisation from '../models/Organisation';
import ReportingPeriod from '../models/ReportingPeriod';
import Facility from '../models/Facility';
import Product from '../models/Product';
import Report, { ReportType, ReportStatus, IXMLValidationResult } from '../models/Report';

interface XMLGeneratorInput {
  organisationId: mongoose.Types.ObjectId;
  reportingPeriodId: mongoose.Types.ObjectId;
  calculationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

interface XMLGeneratorResult {
  success: boolean;
  report?: typeof Report.prototype;
  xmlContent?: string;
  error?: string;
}

// EU Country codes mapping
const COUNTRY_CODES: Record<string, string> = {
  'India': 'IN', 'China': 'CN', 'United States': 'US', 'Germany': 'DE',
  'France': 'FR', 'Italy': 'IT', 'Spain': 'ES', 'United Kingdom': 'GB',
  'Japan': 'JP', 'South Korea': 'KR', 'Brazil': 'BR', 'Russia': 'RU',
  'Australia': 'AU', 'Canada': 'CA', 'Mexico': 'MX', 'Indonesia': 'ID',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Malaysia': 'MY', 'Philippines': 'PH',
  'Singapore': 'SG', 'Taiwan': 'TW', 'Pakistan': 'PK', 'Bangladesh': 'BD',
  'Turkey': 'TR', 'Saudi Arabia': 'SA', 'UAE': 'AE', 'South Africa': 'ZA',
  'Egypt': 'EG', 'Nigeria': 'NG', 'Argentina': 'AR', 'Chile': 'CL',
  'Colombia': 'CO', 'Peru': 'PE', 'Netherlands': 'NL', 'Belgium': 'BE',
  'Poland': 'PL', 'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK',
  'Finland': 'FI', 'Austria': 'AT', 'Switzerland': 'CH', 'Czech Republic': 'CZ',
  'Hungary': 'HU', 'Romania': 'RO', 'Ukraine': 'UA', 'Greece': 'GR',
  'Portugal': 'PT', 'Ireland': 'IE', 'New Zealand': 'NZ'
};

// Format number to CBAM n..16,7 format
function formatCBAMNumber(num: number): string {
  // Maximum 16 digits total, 7 decimal places
  const fixed = num.toFixed(7);
  const parts = fixed.split('.');
  const intPart = parts[0].slice(-9); // Max 9 integer digits to allow for decimals
  return `${intPart}.${parts[1]}`;
}

// Escape XML special characters
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class XMLGenerator {
  private orgId: mongoose.Types.ObjectId;
  private periodId: mongoose.Types.ObjectId;
  private calculationId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;

  constructor(input: XMLGeneratorInput) {
    this.orgId = input.organisationId;
    this.periodId = input.reportingPeriodId;
    this.calculationId = input.calculationId;
    this.userId = input.userId;
  }

  async generate(): Promise<XMLGeneratorResult> {
    try {
      // Fetch all required data
      const [organisation, reportingPeriod, calculation, facilities] = await Promise.all([
        Organisation.findById(this.orgId),
        ReportingPeriod.findById(this.periodId),
        Calculation.findById(this.calculationId).populate('products.product'),
        Facility.find({ organisation: this.orgId })
      ]);

      if (!organisation) {
        return { success: false, error: 'Organisation not found' };
      }
      if (!reportingPeriod) {
        return { success: false, error: 'Reporting period not found' };
      }
      if (!calculation) {
        return { success: false, error: 'Calculation not found' };
      }

      // Generate XML content
      const xmlContent = this.buildXML(organisation, reportingPeriod, calculation, facilities);

      // Validate XML
      const validationResult = this.validateXML(xmlContent);

      // Generate filename
      const fileName = `CBAM_${organisation.name.replace(/\s+/g, '_')}_${reportingPeriod.year}_${reportingPeriod.quarter}.xml`;

      // Create report record
      const report = await Report.create({
        organisation: this.orgId,
        reportingPeriod: this.periodId,
        calculation: this.calculationId,
        type: ReportType.CBAM_XML,
        status: validationResult.isValid ? ReportStatus.VALIDATED : ReportStatus.COMPLETED,
        fileName,
        mimeType: 'application/xml',
        fileSize: Buffer.byteLength(xmlContent, 'utf8'),
        xmlContent,
        xsdVersion: '23.00',
        validationResult,
        generatedAt: new Date(),
        generatedBy: this.userId
      });

      return {
        success: true,
        report,
        xmlContent
      };

    } catch (error) {
      console.error('XML Generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XML generation failed'
      };
    }
  }

  private buildXML(
    org: typeof Organisation.prototype,
    period: typeof ReportingPeriod.prototype,
    calc: ICalculation,
    facilities: typeof Facility.prototype[]
  ): string {
    const countryCode = org.address?.countryCode || 'IN';
    const quarterNum = period.quarter.replace('Q', '');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<QReport xmlns="urn:cbam:quarterly-report:v23.00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="urn:cbam:quarterly-report:v23.00 QReport_ver23.00.xsd">
  
  <!-- Report Header -->
  <ReportHeader>
    <ReportVersion>23.00</ReportVersion>
    <ReportType>QUARTERLY</ReportType>
    <GenerationDate>${new Date().toISOString().split('T')[0]}</GenerationDate>
    <GenerationTime>${new Date().toISOString().split('T')[1].split('.')[0]}</GenerationTime>
  </ReportHeader>

  <!-- Reporting Period -->
  <ReportingPeriod>
    <Year>${period.year}</Year>
    <Quarter>Q${quarterNum}</Quarter>
    <StartDate>${period.year}-${String((parseInt(quarterNum) - 1) * 3 + 1).padStart(2, '0')}-01</StartDate>
    <EndDate>${period.year}-${String(parseInt(quarterNum) * 3).padStart(2, '0')}-${quarterNum === '1' || quarterNum === '4' ? '31' : quarterNum === '2' ? '30' : '30'}</EndDate>
  </ReportingPeriod>

  <!-- Declarant Information -->
  <Declarant>
    <Name>${escapeXML(org.name)}</Name>
    <IdentificationNumber>${org._id.toString().toUpperCase()}</IdentificationNumber>
    <Address>
      <Street>${escapeXML(org.address?.street || '')}</Street>
      <City>${escapeXML(org.address?.city || '')}</City>
      <PostalCode>${escapeXML(org.address?.postalCode || '')}</PostalCode>
      <Country>${countryCode}</Country>
    </Address>
    <DeclarantType>${org.type === 'importer' ? 'IMPORTER' : 'PRODUCER'}</DeclarantType>
  </Declarant>

  <!-- Facilities -->
  <Installations>`;

    // Add facilities
    for (const facility of facilities) {
      xml += `
    <Installation>
      <InstallationId>${facility._id.toString().toUpperCase()}</InstallationId>
      <InstallationName>${escapeXML(facility.name)}</InstallationName>
      <Address>
        <Street>${escapeXML(facility.address?.street || '')}</Street>
        <City>${escapeXML(facility.address?.city || '')}</City>
        <PostalCode>${escapeXML(facility.address?.postalCode || '')}</PostalCode>
        <Country>${facility.address?.countryCode || countryCode}</Country>
      </Address>
    </Installation>`;
    }

    xml += `
  </Installations>

  <!-- Imported Goods -->
  <ImportedGoods>`;

    // Add products with emissions
    for (const product of calc.products) {
      const productDoc = product.product as unknown as { cnCode?: string };
      const cnCode = product.cnCode || productDoc?.cnCode || '00000000';

      xml += `
    <Good>
      <GoodId>${this.generateGoodId()}</GoodId>
      <CNCode>${cnCode}</CNCode>
      <GoodDescription>${escapeXML(product.productName)}</GoodDescription>
      <CountryOfOrigin>${countryCode}</CountryOfOrigin>
      
      <ImportedQuantity>
        <Quantity>${formatCBAMNumber(product.productionQuantity)}</Quantity>
        <Unit>TNE</Unit>
      </ImportedQuantity>
      
      <EmbeddedEmissions>
        <DirectEmissions>
          <Value>${formatCBAMNumber(product.seeDirect)}</Value>
          <Unit>tCO2e/t</Unit>
        </DirectEmissions>
        <IndirectEmissions>
          <Value>${formatCBAMNumber(product.seeIndirect)}</Value>
          <Unit>tCO2e/t</Unit>
        </IndirectEmissions>
        <TotalSpecificEmbeddedEmissions>
          <Value>${formatCBAMNumber(product.seeTotal)}</Value>
          <Unit>tCO2e/t</Unit>
        </TotalSpecificEmbeddedEmissions>
        <TotalEmissions>
          <Value>${formatCBAMNumber(product.totalEmissions)}</Value>
          <Unit>tCO2e</Unit>
        </TotalEmissions>
      </EmbeddedEmissions>
      
      <EmissionDetails>
        <Scope1Emissions>
          <Value>${formatCBAMNumber(product.scope1Emissions)}</Value>
          <Unit>tCO2e</Unit>
          <Sources>`;

      // Add Scope 1 details
      for (const detail of product.scope1Details) {
        xml += `
            <Source>
              <Name>${escapeXML(detail.source)}</Name>
              <Quantity>${formatCBAMNumber(detail.quantity)}</Quantity>
              <QuantityUnit>${detail.unit}</QuantityUnit>
              <EmissionFactor>${formatCBAMNumber(detail.emissionFactor)}</EmissionFactor>
              <Emissions>${formatCBAMNumber(detail.emissions)}</Emissions>
            </Source>`;
      }

      xml += `
          </Sources>
        </Scope1Emissions>
        <Scope2Emissions>
          <Value>${formatCBAMNumber(product.scope2Emissions)}</Value>
          <Unit>tCO2e</Unit>
          <Sources>`;

      // Add Scope 2 details
      for (const detail of product.scope2Details) {
        xml += `
            <Source>
              <Name>${escapeXML(detail.source)}</Name>
              <Quantity>${formatCBAMNumber(detail.quantity)}</Quantity>
              <QuantityUnit>${detail.unit}</QuantityUnit>
              <EmissionFactor>${formatCBAMNumber(detail.emissionFactor)}</EmissionFactor>
              <Emissions>${formatCBAMNumber(detail.emissions)}</Emissions>
            </Source>`;
      }

      xml += `
          </Sources>
        </Scope2Emissions>
        <Scope3Emissions>
          <DirectValue>${formatCBAMNumber(product.scope3DirectEmissions)}</DirectValue>
          <IndirectValue>${formatCBAMNumber(product.scope3IndirectEmissions)}</IndirectValue>
          <TotalValue>${formatCBAMNumber(product.scope3TotalEmissions)}</TotalValue>
          <Unit>tCO2e</Unit>
          <Precursors>`;

      // Add Scope 3 (precursor) details
      for (const detail of product.scope3Details) {
        xml += `
            <Precursor>
              <SupplierMaterial>${escapeXML(detail.source)}</SupplierMaterial>
              <Quantity>${formatCBAMNumber(detail.quantity)}</Quantity>
              <QuantityUnit>${detail.unit}</QuantityUnit>
              <EmissionFactor>${formatCBAMNumber(detail.emissionFactor)}</EmissionFactor>
              <Emissions>${formatCBAMNumber(detail.emissions)}</Emissions>
            </Precursor>`;
      }

      xml += `
          </Precursors>
        </Scope3Emissions>
      </EmissionDetails>
      
      <CalculationMethodology>
        <Method>ACTUAL_DATA</Method>
        <DataSource>INSTALLATION_RECORDS</DataSource>
      </CalculationMethodology>
    </Good>`;
    }

    xml += `
  </ImportedGoods>

  <!-- Summary -->
  <ReportSummary>
    <TotalScope1Emissions>
      <Value>${formatCBAMNumber(calc.totalScope1)}</Value>
      <Unit>tCO2e</Unit>
    </TotalScope1Emissions>
    <TotalScope2Emissions>
      <Value>${formatCBAMNumber(calc.totalScope2)}</Value>
      <Unit>tCO2e</Unit>
    </TotalScope2Emissions>
    <TotalScope3Emissions>
      <Value>${formatCBAMNumber(calc.totalScope3)}</Value>
      <Unit>tCO2e</Unit>
    </TotalScope3Emissions>
    <GrandTotalEmissions>
      <Value>${formatCBAMNumber(calc.totalEmissions)}</Value>
      <Unit>tCO2e</Unit>
    </GrandTotalEmissions>
    <TotalProductionQuantity>
      <Value>${formatCBAMNumber(calc.totalProduction)}</Value>
      <Unit>TNE</Unit>
    </TotalProductionQuantity>
    <NumberOfGoods>${calc.products.length}</NumberOfGoods>
  </ReportSummary>

  <!-- Declaration -->
  <Declaration>
    <DeclarationDate>${new Date().toISOString().split('T')[0]}</DeclarationDate>
    <DeclarantSignature>ELECTRONIC_SIGNATURE</DeclarantSignature>
    <Certification>
      I hereby declare that the information provided in this quarterly report is complete and accurate 
      to the best of my knowledge, and that the embedded emissions have been calculated in accordance 
      with the EU CBAM Regulation requirements.
    </Certification>
  </Declaration>

</QReport>`;

    return xml;
  }

  private generateGoodId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `GOOD-${timestamp}-${random}`;
  }

  private validateXML(xmlContent: string): IXMLValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic XML structure validation
    if (!xmlContent.includes('<?xml version="1.0"')) {
      errors.push('Missing XML declaration');
    }

    if (!xmlContent.includes('<QReport')) {
      errors.push('Missing QReport root element');
    }

    if (!xmlContent.includes('</QReport>')) {
      errors.push('Missing closing QReport tag');
    }

    // Required element checks
    const requiredElements = [
      'ReportingPeriod',
      'Declarant',
      'ImportedGoods',
      'ReportSummary'
    ];

    for (const element of requiredElements) {
      if (!xmlContent.includes(`<${element}`)) {
        errors.push(`Missing required element: ${element}`);
      }
    }

    // CN Code validation
    const cnCodeMatches = xmlContent.match(/<CNCode>(\d+)<\/CNCode>/g);
    if (cnCodeMatches) {
      for (const match of cnCodeMatches) {
        const code = match.replace(/<\/?CNCode>/g, '');
        if (code.length !== 8) {
          warnings.push(`CN Code ${code} should be 8 digits`);
        }
      }
    }

    // Check for empty values
    if (xmlContent.includes('<Value>0.0000000</Value>')) {
      warnings.push('Some emission values are zero - verify data completeness');
    }

    // Numeric format check (n..16,7)
    const valueMatches = xmlContent.match(/<Value>[\d.]+<\/Value>/g);
    if (valueMatches) {
      for (const match of valueMatches) {
        const value = match.replace(/<\/?Value>/g, '');
        const parts = value.split('.');
        if (parts[0].length > 9 || (parts[1] && parts[1].length > 7)) {
          errors.push(`Value ${value} exceeds CBAM numeric format (max n..16,7)`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default XMLGenerator;

