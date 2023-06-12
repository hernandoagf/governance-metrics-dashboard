import { useMemo } from 'react'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import { ResponsivePie } from '@nivo/pie'
import {
  Card,
  Skeleton,
  useTheme,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material'
import { Fullscreen, FullscreenExit } from '@mui/icons-material'

import InfoTooltip from './InfoTooltip'
import styles from '../../styles/Home.module.css'
import { CenteredPieMetric } from './CenteredMetric'
import { kFormatter } from '../../lib/helpers'
import getTheme from '../../lib/nivo/theme'
import { mkrPalette } from '../../lib/nivo/colors'
import { useDashboard } from '../../context/DashboardContext'
import { DelegateBalances } from '../../lib/types/delegate'

type Props = {
  data: DelegateBalances[] | undefined
}

const PieChart = ({ data }: Props): JSX.Element => {
  const theme = useTheme()
  const { selectedTime, setSelectedTime } = useDashboard()
  const handle = useFullScreenHandle()

  return useMemo(() => {
    const chartData = data
      ?.find((elem, idx, array) =>
        selectedTime
          ? elem.time.getTime() === selectedTime
          : idx === array.length - 1
      )
      ?.balances.filter((del) => del.amount > 0)
      .map((del) => ({
        id: del.address,
        label: del.name || del.address,
        value: del.amount,
      }))

    return (
      <FullScreen handle={handle} className={styles.chartCard}>
        <Box
          sx={{
            height: '100%',
            p: handle.active ? 2 : 0,
            bgcolor: handle.active
              ? (theme) => theme.palette.background.default
              : '',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography
              component='h3'
              variant='h6'
              gutterBottom
              sx={{ color: (theme) => theme.palette.text.primary }}
            >
              All Delegates Vote Weights at selected time -{' '}
              {selectedTime
                ? new Date(selectedTime).toLocaleDateString()
                : 'now'}
              <InfoTooltip
                text='You can select the time by clicking on a data point on the Constitutional
          Delegates Vote Weights chart'
              />
            </Typography>
            <Box>
              {selectedTime && (
                <Button
                  size='small'
                  variant='outlined'
                  sx={{ py: 0 }}
                  onClick={() => setSelectedTime(null)}
                >
                  Back to Now
                </Button>
              )}
              <IconButton onClick={handle.active ? handle.exit : handle.enter}>
                {handle.active ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Box>
          </Box>
          <Card className={styles.pieChartContainer}>
            {!chartData ? (
              <Skeleton
                variant='rectangular'
                height={'calc(100% - 1.7em)'}
                sx={{ mt: '1.7em' }}
                animation='wave'
              />
            ) : (
              <ResponsivePie
                data={chartData}
                valueFormat={(value) => kFormatter(+value, 2)}
                margin={{ top: 40, bottom: 25 }}
                innerRadius={0.6}
                cornerRadius={3}
                sortByValue={true}
                activeOuterRadiusOffset={6}
                activeInnerRadiusOffset={2}
                borderWidth={1.5}
                borderColor={{ theme: 'background' }}
                theme={{
                  ...getTheme(theme),
                  fontSize: handle.active ? 15 : 11,
                }}
                colors={mkrPalette}
                arcLinkLabelsSkipAngle={handle.active ? 5 : 10}
                arcLinkLabelsTextColor={theme.palette.text.primary}
                arcLinkLabelsThickness={2}
                arcLinkLabelsStraightLength={36}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={handle.active ? 7 : 15}
                arcLinkLabel={(datum) =>
                  datum.data.label.length === 42 &&
                  datum.data.label.startsWith('0x')
                    ? datum.data.label.slice(0, 12) +
                      '...' +
                      datum.data.label.slice(38)
                    : datum.data.label
                }
                tooltip={(datum) => (
                  <Card className={styles.chartTooltip}>
                    <span
                      className={styles.tooltipCircle}
                      style={{ backgroundColor: datum.datum.color }}
                    ></span>
                    <span>
                      {datum.datum.data.label.length === 42 &&
                      datum.datum.data.label.startsWith('0x')
                        ? datum.datum.data.label.slice(0, 12) +
                          '...' +
                          datum.datum.data.label.slice(38)
                        : datum.datum.data.label}
                      :{' '}
                      <b>
                        {datum.datum.formattedValue} MKR |{' '}
                        {(
                          (datum.datum.arc.angle * 100) /
                          (Math.PI * 2)
                        ).toFixed(2)}{' '}
                        %
                      </b>
                    </span>
                  </Card>
                )}
                layers={[
                  'arcLinkLabels',
                  'arcs',
                  'arcLabels',
                  'legends',
                  CenteredPieMetric,
                ]}
              />
            )}
          </Card>
        </Box>
      </FullScreen>
    )
  }, [data, selectedTime, setSelectedTime, theme, handle])
}

export default PieChart
