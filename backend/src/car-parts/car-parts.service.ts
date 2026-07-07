import { Injectable, Logger } from '@nestjs/common';
import { BigQuery } from '@google-cloud/bigquery';

@Injectable()
export class CarPartsService {
  private readonly logger = new Logger(CarPartsService.name);
  private readonly bigQuery = new BigQuery();
  private readonly partsTable =
    process.env.BIGQUERY_PARTS_TABLE ||
    'pawait-data-hub.cloud_mastery.table_parts_catalog';

  private toIso(value: unknown): string | null {
    if (value && typeof value === 'object' && 'value' in value) {
      return String((value as { value: unknown }).value);
    }
    if (value == null) {
      return null;
    }
    return String(value);
  }

  async findAll() {
    try {
      const [rows] = await this.bigQuery.query({
        query: `
          SELECT
            id,
            sku,
            make,
            model,
            CAST(yearFrom AS STRING) AS yearFrom,
            CAST(yearTo AS STRING) AS yearTo,
            brand,
            batteryType,
            CAST(capacityAh AS STRING) AS capacityAh,
            CAST(cca AS STRING) AS cca,
            CAST(voltage AS STRING) AS voltage,
            CAST(engineCc AS STRING) AS engineCc,
            branchLocation,
            CAST(stock AS STRING) AS stock,
            CAST(warrantyMonths AS STRING) AS warrantyMonths,
            CAST(priceKes AS STRING) AS priceKes,
            image_url AS imageUrl,
            created_at,
            updated_at
          FROM \`${this.partsTable}\`
          ORDER BY created_at DESC
        `,
        location: process.env.BIGQUERY_LOCATION || 'US',
      });

      return (rows as Array<Record<string, unknown>>).map((row) => ({
        id: row.id ? String(row.id) : '',
        sku: row.sku ? String(row.sku) : '',
        make: row.make ? String(row.make) : '',
        model: row.model ? String(row.model) : '',
        yearFrom: row.yearFrom ? String(row.yearFrom) : '',
        yearTo: row.yearTo ? String(row.yearTo) : '',
        brand: row.brand ? String(row.brand) : '',
        batteryType: row.batteryType ? String(row.batteryType) : '',
        capacityAh: row.capacityAh ? String(row.capacityAh) : '0',
        cca: row.cca ? String(row.cca) : '0',
        voltage: row.voltage ? String(row.voltage) : '0',
        engineCc: row.engineCc ? String(row.engineCc) : '0',
        branchLocation: row.branchLocation ? String(row.branchLocation) : '',
        stock: row.stock ? String(row.stock) : '0',
        warrantyMonths: row.warrantyMonths ? String(row.warrantyMonths) : '0',
        priceKes: row.priceKes ? String(row.priceKes) : '0',
        imageUrl: row.imageUrl ? String(row.imageUrl) : null,
        created_at: this.toIso(row.created_at),
        updated_at: this.toIso(row.updated_at),
        order_id: row.order_id ? String(row.order_id) : null,
      }));
    } catch (error) {
      this.logger.error(
        `BigQuery car parts read failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return [];
    }
  }
}
