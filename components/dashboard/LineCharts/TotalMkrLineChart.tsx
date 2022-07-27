import { MkrStakedData, MkrDelegatedData } from '../../../lib/types/delegate'
import LineChart from './LineChart'
import styles from '../../../styles/Home.module.css'

type Props = {
  mkrStakedData: MkrStakedData[] | undefined
  mkrDelegatedData: MkrDelegatedData[] | undefined
}

const TotalMkrLineChart = ({ mkrStakedData, mkrDelegatedData }: Props) => {
  return (
    <LineChart
      chartClass={styles.largeChartCard}
      data={
        mkrStakedData &&
        mkrDelegatedData && [
          {
            id: 'Delegated',
            data: mkrDelegatedData.map((entry) => ({
              x: entry.time,
              y: entry.amount,
            })),
          },
          {
            id: 'Staked',
            data: mkrStakedData.map((entry) => ({
              x: entry.time,
              y: entry.amount,
            })),
          },
        ]
      }
      legendX='Date'
      legendY='MKR'
      title='Total Staked and Delegated MKR'
    />
  )
}

export default TotalMkrLineChart
