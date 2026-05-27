import { env } from "../config/env.js"

type ContractInfoResponse = {
  contract_info?: {
    created?: {
      block_height?: string | number
      tx_index?: string | number
    }
  }
}

export class ContractService {
  constructor(private readonly lcdUrl = env.LCD_URL) {}

  async getContractCreationHeight(contractAddress: string) {
    const response = await fetch(
      `${this.lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}`
    )
    if (!response.ok) {
      throw new Error(
        `LCD contract lookup failed for ${contractAddress}: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as ContractInfoResponse
    const height = Number(data.contract_info?.created?.block_height)
    if (!Number.isFinite(height) || height <= 0) {
      return null
    }
    return height
  }
}
