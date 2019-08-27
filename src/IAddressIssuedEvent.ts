import { IEvent } from "./IEvent";

export interface IAddressIssuedEvent extends IEvent {
  paymailHandle: string;
  idPubKey: string;
  xPubKey: string;
  derivationBase: string;
  addressIndex: number;
  issuedAt: Date;
  issuedTo?: string;
  amount?: number;
  purpose?: string;
}