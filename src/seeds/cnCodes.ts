import mongoose from 'mongoose';
import CNCode, { CBAMCategory } from '../models/CNCode';

// CBAM CN Codes from EU regulation
const cnCodesData = [
  // Iron and Steel
  { code: '72011000', description: 'Non-alloy pig iron containing by weight 0,5 % or less of phosphorus', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72012000', description: 'Non-alloy pig iron containing by weight more than 0,5 % of phosphorus', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72015000', description: 'Alloy pig iron; spiegeleisen', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72021100', description: 'Ferro-manganese containing by weight more than 2 % of carbon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72021900', description: 'Ferro-manganese containing by weight 2 % or less of carbon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72022100', description: 'Ferro-silicon containing by weight more than 55 % of silicon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72023000', description: 'Ferro-silico-manganese', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72024100', description: 'Ferro-chromium containing by weight more than 4 % of carbon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72024900', description: 'Ferro-chromium containing by weight 4 % or less of carbon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72025000', description: 'Ferro-silico-chromium', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72026000', description: 'Ferro-nickel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72029100', description: 'Ferro-titanium and ferro-silico-titanium', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72029200', description: 'Ferro-vanadium', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72029300', description: 'Ferro-niobium', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72031000', description: 'Ferrous products obtained by direct reduction of iron ore', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72039000', description: 'Other spongy ferrous products; iron having purity >= 99.94%', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72041000', description: 'Waste and scrap of cast iron', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72042100', description: 'Waste and scrap of stainless steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72042900', description: 'Waste and scrap of other alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72043000', description: 'Waste and scrap of tinned iron or steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72061000', description: 'Ingots of iron and non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72069000', description: 'Other primary forms of iron and non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72071100', description: 'Semi-finished products of iron or non-alloy steel, < 0.25% carbon, rectangular cross-section', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72071200', description: 'Semi-finished products of iron or non-alloy steel, < 0.25% carbon, other than rectangular', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72072000', description: 'Semi-finished products of iron or non-alloy steel, >= 0.25% carbon', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72081000', description: 'Flat-rolled products of iron/non-alloy steel, width >= 600mm, hot-rolled, in coils, with patterns in relief', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72082500', description: 'Flat-rolled products, width >= 600mm, hot-rolled, pickled, thickness >= 4.75mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72082600', description: 'Flat-rolled products, width >= 600mm, hot-rolled, pickled, 3mm <= thickness < 4.75mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72082700', description: 'Flat-rolled products, width >= 600mm, hot-rolled, pickled, thickness < 3mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72083600', description: 'Flat-rolled products, width >= 600mm, hot-rolled, not in coils, thickness > 10mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72083700', description: 'Flat-rolled products, width >= 600mm, hot-rolled, not in coils, 4.75mm <= thickness <= 10mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72083800', description: 'Flat-rolled products, width >= 600mm, hot-rolled, not in coils, 3mm <= thickness < 4.75mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72083900', description: 'Flat-rolled products, width >= 600mm, hot-rolled, not in coils, thickness < 3mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72091500', description: 'Flat-rolled products, width >= 600mm, cold-rolled, thickness >= 3mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72091600', description: 'Flat-rolled products, width >= 600mm, cold-rolled, 1mm < thickness < 3mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72091700', description: 'Flat-rolled products, width >= 600mm, cold-rolled, 0.5mm <= thickness <= 1mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72091800', description: 'Flat-rolled products, width >= 600mm, cold-rolled, thickness < 0.5mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72101100', description: 'Flat-rolled products, plated/coated with tin, thickness >= 0.5mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72101200', description: 'Flat-rolled products, plated/coated with tin, thickness < 0.5mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72103000', description: 'Flat-rolled products, electrolytically plated/coated with zinc', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72104100', description: 'Flat-rolled products, plated/coated with zinc, corrugated', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72104900', description: 'Flat-rolled products, plated/coated with zinc, other', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72106100', description: 'Flat-rolled products, plated/coated with aluminium-zinc alloys', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72107000', description: 'Flat-rolled products, painted/varnished/plastic-coated', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72110000', description: 'Flat-rolled products, width < 600mm, not clad/plated/coated', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72121000', description: 'Flat-rolled products, width < 600mm, plated/coated with tin', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72122000', description: 'Flat-rolled products, width < 600mm, electrolytically plated/coated with zinc', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72123000', description: 'Flat-rolled products, width < 600mm, otherwise plated/coated with zinc', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72131000', description: 'Bars and rods, hot-rolled, with indentations/ribs, of free-cutting steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72132000', description: 'Bars and rods, hot-rolled, of free-cutting steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72139100', description: 'Bars and rods, hot-rolled, circular cross-section, diameter < 14mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72139900', description: 'Other bars and rods of iron/non-alloy steel, hot-rolled', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72142000', description: 'Bars and rods, with indentations/ribs, of iron/non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72143000', description: 'Other bars and rods of free-cutting steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72149100', description: 'Other bars and rods, rectangular cross-section', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72149900', description: 'Other bars and rods of iron/non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72151000', description: 'Bars and rods of free-cutting steel, cold-formed/finished', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72155000', description: 'Other bars and rods, cold-formed/finished', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72159000', description: 'Other bars and rods of iron/non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72161000', description: 'U, I or H sections, hot-rolled, height < 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72162100', description: 'L sections, hot-rolled, height < 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72162200', description: 'T sections, hot-rolled, height < 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72163100', description: 'U sections, hot-rolled, height >= 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72163200', description: 'I sections (standard beams), hot-rolled, height >= 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72163300', description: 'H sections, hot-rolled, height >= 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72164000', description: 'L or T sections, hot-rolled, height >= 80mm', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72165000', description: 'Other angles/shapes/sections, hot-rolled', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72166100', description: 'Flat-rolled products, cold-formed from flat-rolled products', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72166900', description: 'Other angles/shapes/sections, cold-formed', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72169100', description: 'Angles/shapes/sections, cold-formed from flat-rolled products', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72169900', description: 'Other angles/shapes/sections', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72171000', description: 'Wire of iron/non-alloy steel, not plated/coated', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72172000', description: 'Wire of iron/non-alloy steel, plated/coated with zinc', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72173000', description: 'Wire of iron/non-alloy steel, plated/coated with other base metals', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  { code: '72179000', description: 'Other wire of iron/non-alloy steel', category: CBAMCategory.IRON_STEEL, unit: 'tonnes' },
  
  // Stainless Steel
  { code: '72181000', description: 'Stainless steel in ingots and other primary forms', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72189100', description: 'Semi-finished products of stainless steel, rectangular cross-section', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72189900', description: 'Other semi-finished products of stainless steel', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72191100', description: 'Flat-rolled stainless steel, width >= 600mm, hot-rolled, thickness > 10mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72191200', description: 'Flat-rolled stainless steel, width >= 600mm, hot-rolled, 4.75mm <= thickness <= 10mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72191300', description: 'Flat-rolled stainless steel, width >= 600mm, hot-rolled, 3mm <= thickness < 4.75mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72191400', description: 'Flat-rolled stainless steel, width >= 600mm, hot-rolled, thickness < 3mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72192100', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, thickness > 10mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72192200', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, 4.75mm <= thickness <= 10mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72192300', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, 3mm <= thickness < 4.75mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72192400', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, 0.5mm <= thickness < 3mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72193100', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, thickness < 0.5mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72193300', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, 1mm < thickness < 3mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72193400', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, 0.5mm <= thickness <= 1mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72193500', description: 'Flat-rolled stainless steel, width >= 600mm, cold-rolled, thickness < 0.5mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72199000', description: 'Other flat-rolled stainless steel, width >= 600mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72201100', description: 'Flat-rolled stainless steel, width < 600mm, hot-rolled, thickness >= 4.75mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72201200', description: 'Flat-rolled stainless steel, width < 600mm, hot-rolled, thickness < 4.75mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72202000', description: 'Flat-rolled stainless steel, width < 600mm, cold-rolled', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72209000', description: 'Other flat-rolled stainless steel, width < 600mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72210000', description: 'Bars and rods of stainless steel, hot-rolled, irregularly wound coils', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72221100', description: 'Bars and rods of stainless steel, circular cross-section', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72221900', description: 'Other bars and rods of stainless steel, hot-rolled', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72222000', description: 'Bars and rods of stainless steel, cold-formed/finished', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72223000', description: 'Other bars and rods of stainless steel', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72224000', description: 'Angles/shapes/sections of stainless steel', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72230010', description: 'Wire of stainless steel, containing by weight less than 0,25 % of carbon', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72230091', description: 'Wire of stainless steel, containing >= 0.25% carbon, diameter >= 0.8mm', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },
  { code: '72230099', description: 'Other wire of stainless steel', category: CBAMCategory.IRON_STEEL, subcategory: 'stainless', unit: 'tonnes' },

  // Aluminium
  { code: '76011000', description: 'Unwrought aluminium, not alloyed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76012000', description: 'Unwrought aluminium alloys', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76020000', description: 'Aluminium waste and scrap', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76031000', description: 'Aluminium powders of non-lamellar structure', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76032000', description: 'Aluminium powders of lamellar structure; aluminium flakes', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76041000', description: 'Bars, rods and profiles of aluminium, not alloyed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76042100', description: 'Hollow profiles of aluminium alloys', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76042900', description: 'Other bars, rods and profiles of aluminium alloys', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76051100', description: 'Aluminium wire, not alloyed, max cross-section > 7mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76051900', description: 'Other aluminium wire, not alloyed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76052100', description: 'Aluminium alloy wire, max cross-section > 7mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76052900', description: 'Other aluminium alloy wire', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76061100', description: 'Aluminium plates/sheets/strip, rectangular, not alloyed, thickness > 0.2mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76061200', description: 'Aluminium alloy plates/sheets/strip, rectangular, thickness > 0.2mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76069100', description: 'Other aluminium plates/sheets/strip, not alloyed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76069200', description: 'Other aluminium alloy plates/sheets/strip', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76071100', description: 'Aluminium foil, backed, rolled but not further worked, thickness <= 0.2mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76071900', description: 'Other aluminium foil, backed, thickness <= 0.2mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76072010', description: 'Aluminium foil, not backed, rolled but not further worked, thickness < 0.021mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76072091', description: 'Aluminium foil, not backed, 0.021mm <= thickness <= 0.2mm, annealed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76072099', description: 'Other aluminium foil, not backed, thickness <= 0.2mm', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76081000', description: 'Aluminium tubes and pipes, not alloyed', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },
  { code: '76082000', description: 'Aluminium alloy tubes and pipes', category: CBAMCategory.ALUMINIUM, unit: 'tonnes' },

  // Cement
  { code: '25232100', description: 'White portland cement, whether or not artificially coloured', category: CBAMCategory.CEMENT, unit: 'tonnes' },
  { code: '25232900', description: 'Other portland cement', category: CBAMCategory.CEMENT, unit: 'tonnes' },
  { code: '25233000', description: 'Aluminous cement', category: CBAMCategory.CEMENT, unit: 'tonnes' },
  { code: '25239000', description: 'Other hydraulic cements', category: CBAMCategory.CEMENT, unit: 'tonnes' },
  { code: '25210000', description: 'Limestone flux; limestone and other calcareous stone for cement', category: CBAMCategory.CEMENT, unit: 'tonnes' },

  // Fertilizers
  { code: '28080000', description: 'Nitric acid; sulphonitric acids', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '28342100', description: 'Potassium nitrate', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31021000', description: 'Urea, whether or not in aqueous solution', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31022100', description: 'Ammonium sulphate', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31022900', description: 'Double salts and mixtures of ammonium sulphate and ammonium nitrate', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31023000', description: 'Ammonium nitrate, whether or not in aqueous solution', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31024000', description: 'Mixtures of ammonium nitrate with calcium carbonate or other inorganic non-fertilising substances', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31025000', description: 'Sodium nitrate', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31026000', description: 'Double salts and mixtures of calcium nitrate and ammonium nitrate', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31028000', description: 'Mixtures of urea and ammonium nitrate in aqueous or ammoniacal solution', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31029000', description: 'Other nitrogenous fertilizers, including mixtures', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31051000', description: 'Goods in tablets or similar forms, or in packages of gross weight <= 10kg', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31052000', description: 'Mineral or chemical fertilizers containing N, P, K', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31053000', description: 'Diammonium hydrogenorthophosphate (diammonium phosphate)', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31054000', description: 'Ammonium dihydrogenorthophosphate and mixtures with diammonium', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31055100', description: 'Mineral or chemical fertilizers containing nitrates and phosphates', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31055900', description: 'Other mineral fertilizers containing N and P', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31056000', description: 'Mineral or chemical fertilizers containing P and K', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },
  { code: '31059000', description: 'Other mineral or chemical fertilizers', category: CBAMCategory.FERTILIZERS, unit: 'tonnes' },

  // Electricity
  { code: '27160000', description: 'Electrical energy', category: CBAMCategory.ELECTRICITY, unit: 'MWh' },

  // Hydrogen
  { code: '28041000', description: 'Hydrogen', category: CBAMCategory.HYDROGEN, unit: 'tonnes' },
];

export async function seedCNCodes(): Promise<void> {
  try {
    const count = await CNCode.countDocuments();
    
    if (count > 0) {
      console.log(`CN codes already seeded (${count} records)`);
      return;
    }

    await CNCode.insertMany(cnCodesData);
    console.log(`✅ Seeded ${cnCodesData.length} CN codes`);
  } catch (error) {
    console.error('Error seeding CN codes:', error);
  }
}

export default seedCNCodes;

