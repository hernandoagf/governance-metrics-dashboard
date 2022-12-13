import { utils } from 'ethers'
import { getContract } from '../ethers'
import { CHIEF_ADDRESS } from '../contracts/addresses'
import CHIEF_ABI from '../contracts/abis/DSChief.json'
import {
  DelegateObject,
  DelegationObject,
  DelegateBalance,
  MkrDelegatedData,
  MkrStakedData,
  PollVotersData,
  AllDelegationsObject,
  UserBalances,
  DelegateBalances,
  GroupedUserBalances,
} from '../types/delegate'

export const getGovernanceData = async (): Promise<{
  topDelegates: DelegateBalance[]
  mkrDelegatedData: MkrDelegatedData[]
  totalDelegatorCount: number
  allDelegations: AllDelegationsObject[]
  sankeyData: { nodes: any[]; links: any[] }
}> => {
  const delegationsRes = await getDelegations()

  const {
    currentDelegatesBalance,
    delegations,
    totalDelegatorCount,
    sankeyData,
  } = delegationsRes

  const topDelegates = currentDelegatesBalance.sort(
    (a, b) => +b.lockTotal - +a.lockTotal
  )

  const mkrDelegatedData: MkrDelegatedData[] = []
  delegations
    .map((delegation) => ({
      time: delegation.blockTimestamp,
      amount: +delegation.lockAmount,
    }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .reduce((currVal, nextVal) => {
      mkrDelegatedData.push({
        time: new Date(nextVal.time),
        amount: +(currVal + nextVal.amount).toFixed(2),
      })

      return currVal + nextVal.amount
    }, 0)

  const allDelegations: AllDelegationsObject[] = delegations.map(
    (delegation) => ({
      time: new Date(delegation.blockTimestamp),
      amount: +delegation.lockAmount,
      sender: delegation.fromAddress,
      delegate: delegation.immediateCaller,
    })
  )

  const mkrDelegatedMap = new Map<string, number>()
  mkrDelegatedData.forEach((entry) => {
    mkrDelegatedMap.set(entry.time.toDateString(), entry.amount)
  })
  const newMkrDelegatedData: MkrDelegatedData[] = []
  mkrDelegatedMap.forEach((amount, time) => {
    newMkrDelegatedData.push({ time: new Date(time), amount })
  })

  return {
    topDelegates,
    mkrDelegatedData: newMkrDelegatedData,
    totalDelegatorCount,
    allDelegations,
    sankeyData,
  }
}

const getAllDelegates = async (): Promise<DelegateObject[]> => {
  const query = `
        query allDelegates {
          allDelegates {
            nodes {
              blockTimestamp
              voteDelegate
            }
          }
        }
      `

  const res = await fetch(
    'https://pollingdb2-mainnet-prod.makerdux.com/api/v1',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, operationName: 'allDelegates' }),
    }
  )

  const data = await res.json()

  const delegates: DelegateObject[] = data.data.allDelegates.nodes

  return delegates
}

const getDelegations = async (): Promise<{
  currentDelegatesBalance: DelegateBalance[]
  delegations: DelegationObject[]
  totalDelegatorCount: number
  sankeyData: { nodes: any[]; links: any[] }
}> => {
  const delegates = await getAllDelegates()
  const rawDelegations = await Promise.all(
    delegates.map(async (delegate) => {
      const query = `query mkrLockedDelegateArrayTotalsV2 {
        mkrLockedDelegateArrayTotalsV2 {
          nodes {
            fromAddress
            blockTimestamp
            lockAmount
            lockTotal
            immediateCaller
          }
        }
      }`

      const res = await fetch(
        'https://pollingdb2-mainnet-prod.makerdux.com/api/v1',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            operationName: 'mkrLockedDelegateArrayTotalsV2',
            variables: {
              argAddress: delegate.voteDelegate,
              argUnixTimeStart: 0,
              argUnixTimeEnd: Math.floor(Date.now() / 1000),
            },
          }),
        }
      )

      const data = await res.json()

      const delegations: DelegationObject[] =
        data.data.mkrLockedDelegateArrayTotalsV2.nodes.map(
          (node: DelegationObject) => ({
            ...node,
            fromAddress: node.immediateCaller,
            immediateCaller: delegate.voteDelegate,
          })
        )

      const delegatorsBalances: Map<string, number> = new Map()
      delegations.forEach((delegation) => {
        delegatorsBalances.set(
          delegation.fromAddress,
          delegatorsBalances.has(delegation.fromAddress)
            ? // @ts-ignore
              delegatorsBalances.get(delegation.fromAddress) +
                +delegation.lockAmount
            : +delegation.lockAmount
        )
      })

      let delegatorCount: number = 0
      delegatorsBalances.forEach((value) => {
        if (value > 0) delegatorCount++
      })

      const delegateBalance = {
        voteDelegate: delegate.voteDelegate,
        lockTotal: delegations[delegations.length - 1]?.lockTotal || '0',
        delegatorCount,
        name: '',
        status: '',
        expired: false,
        isAboutToExpire: false,
      }

      return {
        delegateBalance,
        delegations,
      }
    })
  )

  const currentDelegatesBalance = rawDelegations.map(
    (delegation) => delegation.delegateBalance
  )

  const delegatesMetadataRes = await fetch(
    'https://vote.makerdao.com/api/delegates/names'
  )
  const delegatesMetadata = await delegatesMetadataRes.json()

  if (delegatesMetadata && delegatesMetadata.length) {
    // @ts-ignore
    delegatesMetadata.forEach((delegate) => {
      const currentDelegate = currentDelegatesBalance.find(
        (del) => del.voteDelegate === delegate.voteDelegateAddress
      )
      if (currentDelegate) {
        currentDelegate.name =
          delegate.name !== 'Shadow Delegate' ? delegate.name : ''
        currentDelegate.status = delegate.status
        currentDelegate.expired = delegate.expired
        currentDelegate.isAboutToExpire = delegate.isAboutToExpire
      }
    })
  }

  const delegations = rawDelegations
    .map((delegation) => delegation.delegations)
    .flat()

  const totalDelegatorsBalances: Map<string, number> = new Map()
  delegations.forEach((delegation) => {
    totalDelegatorsBalances.set(
      delegation.fromAddress,
      totalDelegatorsBalances.has(delegation.fromAddress)
        ? // @ts-ignore
          totalDelegatorsBalances.get(delegation.fromAddress) +
            +delegation.lockAmount
        : +delegation.lockAmount
    )
  })

  let totalDelegatorCount: number = 0
  totalDelegatorsBalances.forEach((value) => {
    if (value > 0) totalDelegatorCount++
  })

  const formattedDelegations: any[] = []
  delegations
    .filter(
      ({ immediateCaller }) =>
        !delegatesMetadata.some(
          (del: any) =>
            (del.status === 'shadow' || del.status === 'expired') &&
            del.voteDelegateAddress === immediateCaller
        )
    )
    .forEach(({ fromAddress, lockAmount, immediateCaller }) => {
      const foundDelegator = formattedDelegations.find(
        (delegator) => delegator.delegator === fromAddress
      )
      if (!foundDelegator)
        formattedDelegations.push({
          delegator: fromAddress,
          totalDelegated: +lockAmount,
          delegations: [{ delegate: immediateCaller, amount: +lockAmount }],
        })
      else {
        const foundDelegate = foundDelegator.delegations.find(
          (delegation: any) => delegation.delegate === immediateCaller
        )
        if (foundDelegate) {
          foundDelegate.amount += +lockAmount
          foundDelegator.totalDelegated += +lockAmount
        } else {
          foundDelegator.delegations.push({
            delegate: immediateCaller,
            amount: +lockAmount,
          })
          foundDelegator.totalDelegated += +lockAmount
        }
      }
    })

  const delegatorsToDelegates = formattedDelegations
    .filter((delegator) => delegator.totalDelegated > 0)
    .map((delegator) => ({
      ...delegator,
      delegations: delegator.delegations.filter(
        (delegation: any) => delegation.amount > 0
      ),
    }))
    .sort((a, b) => b.totalDelegated - a.totalDelegated)

  const largeDelegators = delegatorsToDelegates.filter(
    (delegator) => delegator.totalDelegated >= 500
  )
  const otherDelegators = delegatorsToDelegates
    .filter((delegator) => delegator.totalDelegated < 500)
    .reduce(
      (acum, current) => {
        acum.totalDelegated += current.totalDelegated
        current.delegations.forEach((delegation: any) => {
          const foundDelegateInAcum = acum.delegations.find(
            (del: any) => del.delegate === delegation.delegate
          )
          if (foundDelegateInAcum)
            foundDelegateInAcum.amount += delegation.amount
          else
            acum.delegations.push({
              delegate: delegation.delegate,
              amount: delegation.amount,
            })
        })

        return acum
      },
      { delegator: 'others', totalDelegated: 0, delegations: [] }
    )

  const allDelegators = [...largeDelegators, otherDelegators]

  const sankeyNodes = [
    ...allDelegators.map((del) => del.delegator),
    ...allDelegators.reduce((result, current) => {
      current.delegations.forEach((delegation: any) =>
        result.add(delegation.delegate)
      )
      return result
    }, new Set()),
  ].map((address) => ({ id: address }))

  const sankeyLinks = [
    ...allDelegators.flatMap(
      ({ delegator, delegations: delegatorDelegations }) =>
        delegatorDelegations
          // @ts-ignore
          .map(({ delegate, amount }) => ({
            source: delegator,
            target: delegate,
            value: amount,
          }))
          .sort((a: any, b: any) => b.value - a.value)
    ),
  ]

  const sankeyData = {
    nodes: sankeyNodes,
    links: sankeyLinks,
  }

  return {
    currentDelegatesBalance,
    delegations,
    totalDelegatorCount,
    sankeyData,
  }
}

export const getStakedMkr = async (): Promise<{
  mkrStakedData: MkrStakedData[]
  stakeEvents: {
    time: Date
    sender: string
    amount: number
  }[]
}> => {
  const contract = getContract(CHIEF_ADDRESS, CHIEF_ABI)
  const lockEvents = await contract.queryFilter(
    {
      topics: [
        '0xdd46706400000000000000000000000000000000000000000000000000000000',
      ],
    },
    '0x487813'
  )

  const freeEvents = await contract.queryFilter(
    {
      topics: [
        '0xd8ccd0f300000000000000000000000000000000000000000000000000000000',
      ],
    },
    '0x487813'
  )

  const stakeEvents = [
    ...lockEvents.map((event) => ({
      blockNumber: event.blockNumber,
      sender: '0x' + event.topics[1].slice(-40),
      amount: +utils.formatEther(event.topics[2]),
    })),
    ...freeEvents.map((event) => ({
      blockNumber: event.blockNumber,
      sender: '0x' + event.topics[1].slice(-40),
      amount: -utils.formatEther(event.topics[2]),
    })),
  ].sort((a, b) => a.blockNumber - b.blockNumber)

  const blockNumbersSet = new Set(stakeEvents.map((event) => event.blockNumber))

  let first = 1000
  let skip = 0
  let total = 0
  const blocksMap: Map<number, string> = new Map()

  while (total < blockNumbersSet.size) {
    const query = `{
      blocks(first: ${first} skip: ${skip} where: {number_in: [${Array.from(
      blockNumbersSet
    )}]}) {
        number
        timestamp
      }
    }`

    const res = await fetch(
      'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    )

    const data = await res.json()
    const blockRes: { number: string; timestamp: string }[] = data.data.blocks
    blockRes.forEach((block) => blocksMap.set(+block.number, block.timestamp))

    total += first
    skip += total
    first =
      blockNumbersSet.size - total < 1000 ? blockNumbersSet.size - total : 1000
  }

  const mkrStakedData: MkrStakedData[] = []

  stakeEvents
    .map((event) => ({
      // @ts-ignore
      time: new Date(blocksMap.get(event.blockNumber) * 1000),
      sender: event.sender,
      amount: event.amount,
    }))
    .reduce((currVal, nextVal) => {
      mkrStakedData.push({
        time: nextVal.time,
        amount: +(currVal + nextVal.amount).toFixed(2),
      })

      return currVal + nextVal.amount
    }, 0)

  const parsedStakeEvents = stakeEvents.map((event) => ({
    // @ts-ignore
    time: new Date(blocksMap.get(event.blockNumber) * 1000),
    sender: event.sender,
    amount: event.amount,
  }))

  const mkrStakedMap = new Map<string, number>()
  mkrStakedData.forEach((entry) => {
    mkrStakedMap.set(entry.time.toDateString(), entry.amount)
  })
  const newMkrStakedData: MkrStakedData[] = []
  mkrStakedMap.forEach((amount, time) => {
    newMkrStakedData.push({ time: new Date(time), amount })
  })

  return { mkrStakedData: newMkrStakedData, stakeEvents: parsedStakeEvents }
}

export const getPollVoters = async (): Promise<PollVotersData[]> => {
  const allPollsQuery = `query activePolls {
    activePolls {
      edges {
        node {
          pollId
          startDate
        }
      }
    }
  }`

  const allPollsRes = await fetch(
    'https://pollingdb2-mainnet-prod.makerdux.com/api/v1',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: allPollsQuery,
        operationName: 'activePolls',
      }),
    }
  )

  const allPollsData = await allPollsRes.json()
  const allPolls = allPollsData.data.activePolls.nodes

  const pollVoters: PollVotersData[] = await Promise.all(
    allPolls.map(
      async ({ pollId, startDate }: { pollId: number; startDate: number }) => {
        const uniqueVotersQuery = `
          query uniqueVoters {
            uniqueVoters {
              nodes
            }
          }`

        const uniqueVotersRes = await fetch(
          'https://pollingdb2-mainnet-prod.makerdux.com/api/v1',
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: uniqueVotersQuery,
              operationName: 'uniqueVoters',
              variables: { argPollId: pollId },
            }),
          }
        )

        const uniqueVotersData = await uniqueVotersRes.json()
        const uniqueVoters = uniqueVotersData.data.uniqueVoters.nodes[0]
        const date = new Date(startDate * 1000)

        return {
          pollId,
          month: `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`,
          uniqueVoters: +uniqueVoters,
        }
      }
    )
  )

  const pollVotersData: {
    month: string
    uniqueVoters: number[]
    pollId: number
  }[] = pollVoters.reduce(
    (
      groups: { month: string; uniqueVoters: number[]; pollId: number }[],
      poll
    ) => {
      if (!groups.some((entry) => entry.month === poll.month))
        groups.push({
          month: poll.month,
          uniqueVoters: [poll.uniqueVoters],
          pollId: poll.pollId,
        })
      else
        groups
          .find((entry) => entry.month === poll.month)
          ?.uniqueVoters.push(poll.uniqueVoters)

      return groups
    },
    []
  )

  return pollVotersData.map(({ month, pollId, uniqueVoters }) => ({
    month,
    pollId,
    uniqueVoters: Math.round(
      uniqueVoters.reduce((a, b) => a + b) / uniqueVoters.length
    ),
  }))
}

export const getMkrBalances = async (
  allDelegations: AllDelegationsObject[] | undefined,
  stakeEvents: { time: Date; sender: string; amount: number }[] | undefined
): Promise<UserBalances[] | undefined> => {
  if (!allDelegations || !stakeEvents) return undefined

  const allTxs: (MkrStakedData & { delegate?: string; sender: string })[] = [
    ...allDelegations,
    ...stakeEvents,
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  const rawUserBalances: UserBalances[] = []
  const balances: { sender: string; amount: number; delegated: number }[] = []

  for (const currVal of allTxs) {
    const user = balances.find((entry) => entry.sender === currVal.sender)

    if (user) {
      currVal.delegate
        ? (user.delegated += currVal.amount)
        : (user.amount += currVal.amount)
    } else {
      currVal.delegate
        ? balances.push({
            sender: currVal.sender,
            amount: 0,
            delegated: currVal.amount,
          })
        : balances.push({
            sender: currVal.sender,
            amount: currVal.amount,
            delegated: 0,
          })
    }

    rawUserBalances.push({
      time: currVal.time,
      balances: balances.map((bal) => ({
        sender: bal.sender,
        amount: bal.amount,
        delegated: bal.delegated,
      })),
    })
  }

  const userBalances = rawUserBalances.map((entry) => ({
    time: entry.time,
    balances: entry.balances.map((bal) => ({
      ...bal,
      amount: +bal.amount.toFixed(2),
      delegated: +bal.delegated.toFixed(2),
    })),
  }))

  const userBalancesMap = new Map<string, UserBalances['balances']>()
  userBalances.forEach((entry) => {
    userBalancesMap.set(entry.time.toDateString(), entry.balances)
  })
  const newUserBalances: UserBalances[] = []
  userBalancesMap.forEach((balances, time) => {
    newUserBalances.push({ time: new Date(time), balances })
  })

  return newUserBalances
}

export const getGroupedBalances = async (
  delegates: DelegateBalance[] | undefined,
  mkrBalancesData: UserBalances[] | undefined
): Promise<GroupedUserBalances | undefined> => {
  if (!delegates || !mkrBalancesData) return undefined

  const recognizedDelegatesMap = new Map<string, string>()

  const recognizedDelegates = delegates
    .filter((del) => del.status === 'recognized')
    .map((del) => {
      recognizedDelegatesMap.set(del.voteDelegate, del.name)
      return del.voteDelegate
    })

  const shadowDelegates = delegates
    .filter((del) => del.status === 'shadow')
    .map((del) => del.voteDelegate)

  const expiredDelegates = delegates
    .filter((del) => del.expired)
    .map((del) => del.voteDelegate)

  const balancesArr = mkrBalancesData[mkrBalancesData.length - 1].balances
    .filter(
      (bal) => bal.amount >= 0.01 && !expiredDelegates.includes(bal.sender)
    )
    .sort((a, b) => b.amount - a.amount)

  const groupedUserBalances: GroupedUserBalances = {
    recognizedDelegates: [],
    shadowDelegates: [],
    users: [],
  }

  for (const { sender, amount } of balancesArr) {
    const formattedBalance = { address: sender, amount }

    if (recognizedDelegates.includes(sender))
      groupedUserBalances.recognizedDelegates.push({
        ...formattedBalance,
        name: recognizedDelegatesMap.get(sender) || '',
      })
    else if (shadowDelegates.includes(sender))
      groupedUserBalances.shadowDelegates.push(formattedBalance)
    else groupedUserBalances.users.push(formattedBalance)
  }

  return groupedUserBalances
}

export const getDelegatesBalances = async (
  allDelegations: AllDelegationsObject[] | undefined,
  topDelegates: DelegateBalance[] | undefined
): Promise<DelegateBalances[] | undefined> => {
  if (!allDelegations || !topDelegates) return undefined

  allDelegations.sort((a, b) => a.time.getTime() - b.time.getTime())

  const delegateInitialBalances: DelegateBalances['balances'] =
    topDelegates.map((del) => ({
      name: del.name,
      address: del.voteDelegate,
      amount: 0,
    }))

  const delegateBalances: DelegateBalances[] = []

  for (const delegation of allDelegations) {
    const delegateBal = delegateInitialBalances.find(
      (del) => del.address === delegation.delegate
    )
    if (!delegateBal) return undefined

    delegateBal.amount += delegation.amount

    delegateBalances.push({
      time: delegation.time,
      balances: delegateInitialBalances.map((del) => ({
        name: del.name,
        address: del.address,
        amount: del.amount,
      })),
    })
  }
  return delegateBalances
}
