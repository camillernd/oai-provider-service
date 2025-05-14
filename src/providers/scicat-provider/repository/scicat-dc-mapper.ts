import logger from "../../../server/logger";
import {ProviderDCMapper} from "../../core/core-oai-provider";

export class ScicatDcMapper extends ProviderDCMapper {

  route = process.env.SCICAT_ROUTE || "/scicat/oai";

  /**
   * The Universal Coordinated Time (UTC) date needs to be modifed
   * to match the local timezone.
   * @param record the raw data returned by the mongo dao query
   * @returns {string}
   */
  private setTimeZoneOffset(record: any): string {
      const date = new Date(record?.registeredTime?.$date ?? Date.now());
      const timeZoneCorrection = new Date(date.getTime() + date.getTimezoneOffset() * -60000);
      timeZoneCorrection.setMilliseconds(0);
      return timeZoneCorrection.toISOString().split('.')[0] + "Z";

  }

  private getRightsMessage(restricted: boolean): string {
      if (restricted) {
          return "Restricted to University users."
      }
      return "Available to the public."
  }

  private createItemRecord(record: any): any {
    const updatedAt: string = this.setTimeZoneOffset(record);
  
    const dcMetadata: any[] = [
      {
        _attr: {
          'xmlns:oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
          'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          'xsi:schemaLocation': 'http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd'
        }
      },
      record.title && { 'dc:title': record.title },
      ...(Array.isArray(record.creator) ? record.creator.map((c: string) => ({ 'dc:creator': c })) : record.creator ? [{ 'dc:creator': record.creator }] : []),
      ...(Array.isArray(record.contributor) ? record.contributor.map((c: string) => ({ 'dc:contributor': c })) : []),
      record.id_organization_editor && { 'dc:publisher': record.id_organization_editor },
      record.date_publication && { 'dc:date': record.date_publication },
      ...(Array.isArray(record.languages) ? record.languages.map((l: string) => ({ 'dc:language': l })) : []),
      record.description && { 'dc:description': record.description },
      ...(Array.isArray(record.countries) ? record.countries.map((c: string) => ({ 'dc:coverage': c })) : []),
      ...(Array.isArray(record.iso_regions) ? record.iso_regions.map((r: string) => ({ 'dc:coverage': r })) : []),
      ...(Array.isArray(record.subjects) ? record.subjects.map((s: string) => ({ 'dc:subject': s })) : []),
      ...(Array.isArray(record.files) ? record.files.map((f: any) => ({ 'dc:format': f.format })) : []),
      typeof record.pages === 'number' && { 'dc:format': `${record.pages} pages` },
      record.type && { 'dc:type': record.type },
      record.identifier && { 'dc:identifier': record.identifier },
      record.doi && { 'dc:identifier': `doi:${record.doi}` },
/*       record[this.collection_id] && { 'dc:identifier': process.env.BASE_URL + "/detail/" + encodeURIComponent(record[this.collection_id]) },
 */      record.id_parent && { 'dc:relation': record.id_parent },
      record.import_source && { 'dc:source': record.import_source },
      record.license && { 'dc:rights': record.license }
    ].filter(Boolean); // remove nulls
  
    const item = {
      record: [
        {
          header: [
            { 'identifier': record[this.collection_id] },
            ...(record.setSpecs || []).map((s: string) => ({ setSpec: s })),
            { 'datestamp': updatedAt }
          ]
        },
        {
          metadata: [
            {
              'oai_dc:dc': dcMetadata
            }
          ]
        }
      ]
    };
  
    return item;
  }

  public mapOaiDcListRecords(records: any[]): any {
    const list = [];
    const response = {
      ListRecords: <any>[]
    };

    for (let record of records) {
      let item = this.createItemRecord(record);
      list.push(item);
    }

    logger.debug("Parsed " + list.length + " records into OAI xml format.");

    response.ListRecords = list;

    return response;
  }

  public mapOaiDcGetRecord(record: any): any {
    if (!record) {
      throw new Error("Record not found");
    }
  
    const item = this.createItemRecord(record);
    const result = {
      GetRecord: [item]
    };
  
    logger.debug("Got item with id " + record[this.collection_id] + ", title: " + record.title);
    logger.debug("🧾 mapOaiDcGetRecord result =", JSON.stringify(result, null, 2));
  
    return result;
  }

  public mapOaiDcListIdentifiers(records: any[]): any {
    const list = [];
  
    for (let record of records) {
      const updatedAt: string = this.setTimeZoneOffset(record);
  
      const item = {
        header: [
          { identifier: record[this.collection_id]?.toString() },
          { datestamp: updatedAt },
          ...(record.setSpecs || []).map((s: string) => ({ setSpec: s }))
        ]
      };
  
      list.push(item);
    }
  
    const response = {
      ListIdentifiers: list
    };
  
    logger.debug("🧾 mapOaiDcListIdentifiers result =", JSON.stringify(response, null, 2));
    return response;
  }

  public mapOaiDcListSets(records: any[]): any {
    const response = {
      ListSets: <any>[]
    };
  
    if (!records || records.length === 0) {
      return response;
    }
  
    const list = records.map((rec: any) => ({
      set: [
        { setSpec: rec.setSpec },
        { setName: rec.setName }
      ]
    }));
  
    response.ListSets = list;
    return response;
  }
  
}
