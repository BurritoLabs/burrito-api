export type TendermintAttribute = {
  key: string
  value?: string
  index?: boolean
}

export type TendermintEvent = {
  type: string
  attributes?: TendermintAttribute[]
}

export type TxSearchResult = {
  hash: string
  height: string
  index: number
  tx_result?: {
    events?: TendermintEvent[]
  }
}

export type TxSearchResponse = {
  result?: {
    total_count?: string
    txs?: TxSearchResult[]
  }
}

export type BlockResponse = {
  result?: {
    block?: {
      header?: {
        height?: string
        time?: string
      }
    }
  }
}

export type StatusResponse = {
  result?: {
    sync_info?: {
      latest_block_height?: string
    }
  }
}
