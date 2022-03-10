import { useState, MouseEvent } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import useSWRImmutable from 'swr/immutable'
import { ResponsiveBar } from '@nivo/bar'
import {
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  Skeleton,
  Card,
  Autocomplete,
  TextField,
  createTheme,
  ThemeProvider,
} from '@mui/material'

import {
  getGovernanceData,
  getStakedMkr,
  getPollVoters,
  getMkrBalances,
} from '../lib/governanceData'
import LineChart from '../components/LineChart'
import DataCard from '../components/DataCard'
import {
  kFormatter,
  reduceAndFormatDelegations,
  reduceDelegators,
} from '../lib/helpers'
import styles from '../styles/Home.module.css'

const theme = createTheme({
  palette: { primary: { main: 'hsl(173, 74%, 39%)' } },
})

const Home: NextPage = () => {
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [orderBy, setOrderBy] = useState<'lockTotal' | 'delegatorCount'>(
    'lockTotal'
  )
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

  const { data: governanceData, error } = useSWRImmutable(
    '/governanceData',
    getGovernanceData
  )
  const { data: stakedMkrData } = useSWRImmutable(
    '/stakedMkrData',
    getStakedMkr
  )
  const { data: mkrBalancesData } = useSWRImmutable(
    () => (governanceData && stakedMkrData ? '/mkrBalancesData' : null),
    () =>
      getMkrBalances(governanceData?.allDelegations, stakedMkrData?.stakeEvents)
  )
  const { data: pollVotersData } = useSWRImmutable(
    '/pollVotersData',
    getPollVoters
  )

  if (error) {
    console.log(error)
    return (
      <div>
        There was an error trying to load the data, please refresh the site
      </div>
    )
  }

  const handleRequestSort = (
    event: MouseEvent<unknown>,
    property: 'lockTotal' | 'delegatorCount'
  ) => {
    const isAsc = orderBy === property && order === 'desc'
    setOrder(isAsc ? 'asc' : 'desc')
    setOrderBy(property)

    governanceData?.topDelegates.sort((a, b) =>
      // @ts-ignore
      isAsc ? a[property] - b[property] : b[property] - a[property]
    )
  }

  const handleSort =
    (property: 'lockTotal' | 'delegatorCount') =>
    (event: MouseEvent<unknown>) => {
      handleRequestSort(event, property)
    }

  const recognizedDelegates =
    governanceData &&
    governanceData.topDelegates.filter(
      (delegate) => delegate.status === 'recognized'
    )

  const shadowDelegates =
    governanceData &&
    governanceData.topDelegates.filter(
      (delegate) => delegate.status === 'shadow'
    )

  return (
    <ThemeProvider theme={theme}>
      <div className={styles.container}>
        <Head>
          <title>MakerDAO Governance Dashboard</title>
          <meta
            name='description'
            content='A dashboard containing metrics about MakerDAO governance and delegation'
          />
          <link rel='icon' href='/favicon.ico' />
        </Head>

        <nav className={styles.nav}>
          <div className={styles.logoContainer}>
            <Image
              src='/makerlogo.png'
              alt='Maker logo'
              width={42}
              height={30}
            />
            MakerDAO Governance Metrics
          </div>
          <Autocomplete
            value={selectedAddress}
            onChange={(event: any, newAddress: string | null) => {
              setSelectedAddress(newAddress)
            }}
            options={
              mkrBalancesData
                ? mkrBalancesData[mkrBalancesData.length - 1].balances.map(
                    (bal) => bal.sender
                  )
                : []
            }
            sx={{ width: 200 }}
            renderInput={(params) => <TextField {...params} label='Address' />}
          />
        </nav>

        <main className={styles.main}>
          <Card className={styles.tableCard}>
            <h3>Top Recognized Delegates</h3>
            {!recognizedDelegates ? (
              <>
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
              </>
            ) : (
              <TableContainer sx={{ maxHeight: 'calc(100% - 50px)' }}>
                <Table
                  stickyHeader
                  size='small'
                  aria-label='top delegates table'
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        Delegate
                      </TableCell>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === 'delegatorCount'}
                          direction={
                            orderBy === 'delegatorCount' ? order : 'desc'
                          }
                          onClick={handleSort('delegatorCount')}
                        >
                          Delegators
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === 'lockTotal'}
                          direction={orderBy === 'lockTotal' ? order : 'desc'}
                          onClick={handleSort('lockTotal')}
                        >
                          MKR Delegated
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recognizedDelegates.map((delegate, i) => (
                      <TableRow hover key={i}>
                        <TableCell align='left'>
                          <a
                            href={`https://etherscan.io/address/${delegate.voteDelegate}`}
                            target='_blank'
                            rel='noreferrer'
                          >
                            {delegate.name}
                          </a>
                        </TableCell>
                        <TableCell align='center'>
                          {delegate.delegatorCount}
                        </TableCell>
                        <TableCell align='center'>
                          {parseInt(delegate.lockTotal).toLocaleString('en-US')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
          <Card className={styles.tableCard}>
            <h3>Top Shadow Delegates</h3>
            {!shadowDelegates ? (
              <>
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
                <Skeleton animation='wave' height={65} />
              </>
            ) : (
              <TableContainer sx={{ maxHeight: 'calc(100% - 50px)' }}>
                <Table
                  stickyHeader
                  size='small'
                  aria-label='top delegates table'
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        Delegate
                      </TableCell>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === 'delegatorCount'}
                          direction={
                            orderBy === 'delegatorCount' ? order : 'desc'
                          }
                          onClick={handleSort('delegatorCount')}
                        >
                          Delegators
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        align='center'
                        style={{
                          textTransform: 'capitalize',
                          fontWeight: 'bold',
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === 'lockTotal'}
                          direction={orderBy === 'lockTotal' ? order : 'desc'}
                          onClick={handleSort('lockTotal')}
                        >
                          MKR Delegated
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shadowDelegates.map((delegate, i) => (
                      <TableRow hover key={i}>
                        <TableCell align='left'>
                          <a
                            href={`https://etherscan.io/address/${delegate.voteDelegate}`}
                            target='_blank'
                            rel='noreferrer'
                          >
                            {delegate.voteDelegate.slice(0, 8) +
                              '...' +
                              delegate.voteDelegate.slice(38)}
                          </a>
                        </TableCell>
                        <TableCell align='center'>
                          {delegate.delegatorCount}
                        </TableCell>
                        <TableCell align='center'>
                          {parseInt(delegate.lockTotal).toLocaleString('en-US')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
          <DataCard
            title='Delegates count'
            data={
              governanceData && [
                { name: 'Recognized', value: recognizedDelegates?.length || 0 },
                { name: 'Shadow', value: shadowDelegates?.length || 0 },
                { name: 'Total', value: governanceData.topDelegates.length },
              ]
            }
          />
          <DataCard
            title='MKR delegated'
            data={
              governanceData && [
                {
                  name: 'Recognized',
                  value: reduceAndFormatDelegations(recognizedDelegates),
                },
                {
                  name: 'Shadow',
                  value: reduceAndFormatDelegations(shadowDelegates),
                },
                {
                  name: 'Total',
                  value: reduceAndFormatDelegations(
                    governanceData.topDelegates
                  ),
                },
              ]
            }
          />
          <DataCard
            title='Delegators count'
            data={
              governanceData && [
                {
                  name: 'Recognized',
                  value: reduceDelegators(recognizedDelegates),
                },
                { name: 'Shadow', value: reduceDelegators(shadowDelegates) },
                {
                  name: 'Total',
                  value: reduceDelegators(governanceData.topDelegates),
                },
              ]
            }
          />
          <LineChart
            datasetOne={stakedMkrData?.mkrStakedData.map((entry) => ({
              x: entry.time,
              y: entry.amount,
            }))}
            datasetTwo={governanceData?.mkrDelegatedData.map((entry) => ({
              x: entry.time,
              y: entry.amount,
            }))}
            datasetOneId='Staked'
            datasetTwoId='Delegated'
            legendX='Date'
            legendY='MKR'
            title='Staked and Delegated MKR'
          />
          <Card className={styles.chartCard}>
            <h3>Average unique voters per poll per month</h3>
            <div className={styles.chartContainer}>
              {!pollVotersData ? (
                <Skeleton
                  variant='rectangular'
                  height={'100%'}
                  animation='wave'
                />
              ) : (
                <ResponsiveBar
                  data={pollVotersData}
                  colors='#f4b62f'
                  keys={['uniqueVoters']}
                  indexBy='month'
                  margin={{ left: 60, bottom: 40, top: 5, right: 50 }}
                  padding={0.2}
                  theme={{
                    axis: {
                      legend: {
                        text: {
                          fontWeight: 'bold',
                        },
                      },
                    },
                  }}
                  axisLeft={{
                    legend: 'Voters',
                    legendOffset: -50,
                    legendPosition: 'middle',
                    format: '.2s',
                  }}
                  axisBottom={{
                    legend: 'Month',
                    legendOffset: 36,
                    legendPosition: 'middle',
                    tickValues: pollVotersData
                      .filter((entry, i) => i % 4 === 0)
                      .map((entry) => entry.month),
                  }}
                  isInteractive={true}
                  enableLabel={false}
                  tooltip={({ data, color }) => (
                    <div className={styles.chartTooltip}>
                      <span
                        className={styles.tooltipCircle}
                        style={{ backgroundColor: color }}
                      ></span>
                      <span>
                        {data.month}: <b>{data.uniqueVoters}</b> voters
                      </span>
                    </div>
                  )}
                />
              )}
            </div>
          </Card>
          <LineChart
            datasetOne={mkrBalancesData?.map((entry) => ({
              x: entry.time,
              y:
                entry.balances.find((bal) => bal.sender === selectedAddress)
                  ?.amount || 0,
            }))}
            datasetTwo={mkrBalancesData?.map((entry) => ({
              x: entry.time,
              y:
                entry.balances.find((bal) => bal.sender === selectedAddress)
                  ?.delegated || 0,
            }))}
            datasetOneId='Staked'
            datasetTwoId='Delegated'
            legendX='Date'
            legendY='MKR'
            title={
              selectedAddress
                ? `Staked and Delegated MKR for user ${selectedAddress}`
                : 'Please select an address on the navbar selector to render the data'
            }
            enableArea={true}
          />
        </main>

        <footer className={styles.footer}>
          Built by the GovAlpha Core Unit
        </footer>
      </div>
    </ThemeProvider>
  )
}

export default Home
