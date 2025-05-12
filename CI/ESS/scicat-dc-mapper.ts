// Importe le logger du serveur pour afficher des messages de debug
import logger from "../../../server/logger";

// Importe l’interface que doit implémenter cette classe pour être un mapper OAI-DC
import { ProviderDCMapper } from "../../core/core-oai-provider";

// Définit une classe ScicatDcMapper qui sert à transformer les données Mongo en réponses OAI-PMH
export class ScicatDcMapper implements ProviderDCMapper {
  
  /**
   * Convertit une date UTC pour l’ajuster au fuseau horaire local (timezone offset).
   * @param record - enregistrement Mongo brut
   * @returns {string} - date ISO corrigée, sans millisecondes
   */
  private setTimeZoneOffset(record: any): string {
    const date = new Date(record.updatedAt); // récupère la date mise à jour
    const timeZoneCorrection = new Date(
      date.getTime() + date.getTimezoneOffset() * -60000 // applique l’offset en ms
    );
    return timeZoneCorrection.toISOString().split(".")[0] + "Z"; // retourne date ISO sans ms
  }

  /**
   * Renvoie un message de droits selon si le document est restreint ou non.
   * @param restricted - boolean indiquant les droits
   * @returns {string} - message texte
   */
  private getRightsMessage(restricted: boolean): string {
    if (restricted) {
      return "Restricted to University users.";
    }
    return "Available to the public.";
  }

  /**
   * Crée un bloc complet d’un enregistrement OAI structuré en DataCite.
   * @param record - l’enregistrement Mongo brut
   * @returns {any} - objet formaté pour être inséré dans le flux XML
   */
  private createItemRecord(record: any): any {
    let item = {
      record: [
        {
          header: [
            {
              identifier: [
                { _attr: { identifierType: "doi" } }, // type DOI
                record._id.toString() // identifiant du document
              ]
            },
            { setSpec: "openaire_data" }, // set exposé, ici fixe
            { datestamp: "2020-01-01" } // date fixe codée en dur
          ]
        },
        {
          metadata: [
            {
              "datacite:resource": [
                {
                  _attr: {
                    "xmlns:rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
                    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                    "xmlns:dcterms": "http://purl.org/dc/terms/",
                    "xmlns:datacite": "http://datacite.org/schema/kernel-4",
                    xmlns: "http://namespace.openaire.eu/schema/oaire/",
                    "xsi:schemaLocation":
                      "http://www.openarchives.org/OAI/2.0/oai_dc/ " +
                      "https://www.openaire.eu/schema/repo-lit/4.0/openaire.xsd"
                  }
                },
                // TITRE
                {
                  "datacite:titles": [{ title: record.title }]
                },
                // IDENTIFIANT (URL avec DOI)
                {
                  "datacite:identifier": [
                    { _attr: { identifierType: "URL" } },
                    "https://doi.org/" + record._id.toString()
                  ]
                },
                // DESCRIPTION
                {
                  "datacite:descriptions": [
                    {
                      description: [
                        { _attr: { descriptionType: "Abstract" } },
                        record.dataDescription
                      ]
                    }
                  ]
                },
                // DATES (fixes, codées en dur)
                {
                  "datacite:dates": [
                    {
                      "datacite:date": [
                        { _attr: { dateType: "Issued" } },
                        "2020-01-01"
                      ]
                    },
                    {
                      "datacite:date": [
                        { _attr: { dateType: "Available" } },
                        "2020-01-01"
                      ]
                    }
                  ]
                },
                // ANNÉE DE PUBLICATION
                { "datacite:publicationYear": record.publicationYear },
                // CRÉATEUR + AFFILIATION
                {
                  "datacite:creators": [
                    {
                      creator: [
                        {
                          creatorName: record.creator
                        },
                        {
                          affiliation: record.affiliation
                        }
                      ]
                    }
                  ]
                },
                // ÉDITEUR
                { "datacite:publisher": record.publisher },
                // VERSION (toujours 1)
                { "datacite:version": 1 },
                // DROITS (toujours openAccess ici)
                {
                  "datacite:rightsList": [
                    {
                      "datacite:rights": [
                        {
                          _attr: {
                            rightsURI: "info:eu-repo/semantics/openAccess"
                          }
                        },
                        "OpenAccess"
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    return item; // retourne le bloc complet pour cet enregistrement
  }

  /**
   * Génère une réponse ListRecords (liste complète des enregistrements OAI).
   * @param records - tableau des enregistrements Mongo
   * @returns {any} - réponse structurée pour l’API OAI
   */
  public mapOaiDcListRecords(records: any[]): any {
    const list = [];
    const response = {
      ListRecords: <any>[]
    };

    for (let record of records) {
      let item = this.createItemRecord(record); // transforme chaque record
      list.push(item);
    }

    logger.debug("Parsed " + list.length + " records into OAI xml format.");

    response.ListRecords = list;

    return response;
  }

  /**
   * Génère une réponse GetRecord (récupération d’un enregistrement unique).
   * @param record - un enregistrement Mongo
   * @returns {any} - réponse structurée pour l’API OAI
   */
  public mapOaiDcGetRecord(record: any): any {
    if (!record) {
      throw new Error("Record not found");
    }

    let item = this.createItemRecord(record); // transforme le record
    logger.debug("Got item with id " + record._id + ", title: " + record.title);
    return item;
  }

  /**
   * Génère une réponse ListIdentifiers (récupère seulement les identifiants).
   * @param records - tableau des enregistrements Mongo
   * @returns {any} - réponse structurée pour l’API OAI
   */
  public mapOaiDcListIdentifiers(records: any[]): any {
    const list = [];
    const response = {
      ListIdentifiers: <any>[]
    };

    for (let record of records) {
      const updatedAt: string = this.setTimeZoneOffset(record);
      let item = {
        record: [
          {
            header: [
              { identifier: record.id.toString() },
              { datestamp: updatedAt }
            ]
          }
        ]
      };

      list.push(item);
    }

    response.ListIdentifiers = list;

    return response;
  }

  /**
   * Génère une réponse ListSets (liste des sets disponibles dans le serveur OAI).
   * @param records - non utilisé ici (codé en dur)
   * @returns {any} - réponse structurée pour l’API OAI
   */
  public mapOaiDcListSets(records: any[]): any {
    const response = {
      ListSets: <any>[]
    };
    const list = [];
    let item = {
      set: [{ setName: "openaire_data" }, { setSpec: "openaire_data" }]
    };
    list.push(item);

    response.ListSets = list;
    return response;
  }
}


