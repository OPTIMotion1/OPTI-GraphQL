// List all unmapped vehicles from VoltCred
require('dotenv').config();
const { getAssets } = require('./src/services/voltcred.service');
const fs = require('fs');
const path = require('path');

// Load IMEI mapping
const MAPPING_FILE = path.join(__dirname, 'data', 'vehicle-imei-mapping.json');
let imeiMapping = {};

try {
  const data = fs.readFileSync(MAPPING_FILE, 'utf8');
  imeiMapping = JSON.parse(data);
  delete imeiMapping._comment;
  delete imeiMapping._instructions;
} catch (error) {
  console.error('Error loading mapping file:', error.message);
}

async function listUnmappedVehicles() {
  try {
    console.log('=== Fetching all vehicles from VoltCred ===\n');
    
    const result = await getAssets();
    const assets = result.assets || [];
    
    console.log(`Total vehicles in VoltCred: ${assets.length}\n`);
    console.log(`Total mapped vehicles: ${Object.keys(imeiMapping).length}\n`);
    
    const unmapped = [];
    const mapped = [];
    
    assets.forEach(asset => {
      const imei = asset.name;
      const mappedName = imeiMapping[imei];
      
      if (mappedName && mappedName !== 'UNKNOWN') {
        mapped.push({
          imei: imei,
          vehicleId: mappedName,
          status: asset.status,
          assetId: asset.id
        });
      } else {
        unmapped.push({
          imei: imei,
          originalName: asset.name,
          status: asset.status,
          assetId: asset.id,
          licensePlate: asset.license_plate,
          assetType: asset.asset_type
        });
      }
    });
    
    console.log('=== MAPPED VEHICLES ===');
    console.log(`Total: ${mapped.length}\n`);
    mapped.forEach(v => {
      console.log(`✅ ${v.imei} → ${v.vehicleId} (Asset ID: ${v.assetId}, Status: ${v.status})`);
    });
    
    console.log('\n\n=== UNMAPPED VEHICLES ===');
    console.log(`Total: ${unmapped.length}\n`);
    
    if (unmapped.length === 0) {
      console.log('🎉 All vehicles are mapped!');
    } else {
      unmapped.forEach((v, index) => {
        console.log(`${index + 1}. IMEI: ${v.imei}`);
        console.log(`   Asset ID: ${v.assetId}`);
        console.log(`   Status: ${v.status}`);
        if (v.licensePlate && v.licensePlate !== 'false') {
          console.log(`   License Plate: ${v.licensePlate}`);
        }
        if (v.assetType) {
          console.log(`   Asset Type: ${v.assetType}`);
        }
        console.log('');
      });
      
      console.log('\n=== UNMAPPED IMEIs (for quick mapping) ===');
      unmapped.forEach(v => {
        console.log(`  "${v.imei}": "VEHICLE_ID_HERE",`);
      });
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total vehicles: ${assets.length}`);
    console.log(`Mapped: ${mapped.length}`);
    console.log(`Unmapped: ${unmapped.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUnmappedVehicles();
