import React, { useState, useEffect, useRef } from 'react'
import { useValues, useActions } from 'kea'
import Chart from 'chart.js'
import PropTypes from 'prop-types'
import { operatorMap, humanFriendlyDetailedTime } from '~/lib/utils'
import _ from 'lodash'
import { getChartColors } from 'lib/colors'
import { useWindowSize } from 'lib/hooks/useWindowSize'
import { annotationsModel } from '~/models'
import { Button, Popover, Row, Input } from 'antd'
const { TextArea } = Input
import moment from 'moment'
import { PlusOutlined } from '@ant-design/icons'
import { userLogic } from 'scenes/userLogic'
//--Chart Style Options--//
// Chart.defaults.global.defaultFontFamily = "'PT Sans', sans-serif"
Chart.defaults.global.legend.display = false
//--Chart Style Options--//

export function LineGraph({
    datasets,
    labels,
    color,
    type,
    isInProgress,
    onClick,
    ['data-attr']: dataAttr,
    dashboardItemId,
}) {
    const chartRef = useRef()
    const myLineChart = useRef()
    const [left, setLeft] = useState(0)
    const [enabled, setEnabled] = useState(false)
    const [focused, setFocused] = useState(false)
    const [labelIndex, setLabelIndex] = useState(null)
    const [selectedDayLabel, setSelectedDayLabel] = useState(null)
    const { createAnnotation, createAnnotationNow } = useActions(
        annotationsModel({ pageKey: dashboardItemId ? dashboardItemId : null })
    )
    const [textInput, setTextInput] = useState('')
    const [leftExtent, setLeftExtent] = useState(0)
    const [interval, setInterval] = useState(0)
    const [topExtent, setTopExtent] = useState(0)
    const size = useWindowSize()

    useEffect(() => {
        buildChart()
    }, [datasets, color])

    useEffect(() => {
        const leftExtent = myLineChart.current.scales['x-axis-0'].left
        const rightExtent = myLineChart.current.scales['x-axis-0'].right
        const ticks = myLineChart.current.scales['x-axis-0'].ticks.length
        const delta = rightExtent - leftExtent
        const interval = delta / (ticks - 1)
        const topExtent = myLineChart.current.scales['x-axis-0'].top + 12
        setLeftExtent(leftExtent)
        setInterval(interval)
        setTopExtent(topExtent)
    }, [myLineChart.current, size])

    function processDataset(dataset, index) {
        const colorList = getChartColors(color || 'white')

        return {
            borderColor: colorList[index],
            backgroundColor: (type === 'bar' || type === 'doughnut') && colorList[index],
            fill: false,
            borderWidth: 1,
            pointHitRadius: 8,
            ...dataset,
        }
    }

    function buildChart() {
        const myChartRef = chartRef.current.getContext('2d')

        const axisLabelColor = color === 'white' ? '#333' : 'rgba(255,255,255,0.8)'
        const axisLineColor = color === 'white' ? '#ddd' : 'rgba(255,255,255,0.2)'
        const axisColor = color === 'white' ? '#999' : 'rgba(255,255,255,0.6)'

        if (typeof myLineChart.current !== 'undefined') myLineChart.current.destroy()
        // if chart is line graph, make duplicate lines and overlay to show dotted lines
        datasets =
            !type || type === 'line'
                ? [
                      ...datasets.map((dataset, index) => {
                          let datasetCopy = Object.assign({}, dataset)
                          let data = [...dataset.data]
                          let labels = [...dataset.labels]
                          let days = [...dataset.days]
                          data.pop()
                          labels.pop()
                          days.pop()
                          datasetCopy.data = data
                          datasetCopy.labels = labels
                          datasetCopy.days = days
                          return processDataset(datasetCopy, index)
                      }),
                      ...datasets.map((dataset, index) => {
                          let datasetCopy = Object.assign({}, dataset)
                          let datasetLength = datasetCopy.data.length
                          datasetCopy.dotted = true

                          // if last date is still active show dotted line
                          if (isInProgress) {
                              datasetCopy.borderDash = [10, 10]
                          }

                          datasetCopy.data =
                              datasetCopy.data.length > 2
                                  ? datasetCopy.data.map((datum, index) =>
                                        index === datasetLength - 1 || index === datasetLength - 2 ? datum : null
                                    )
                                  : datasetCopy.data
                          return processDataset(datasetCopy, index)
                      }),
                  ]
                : datasets.map((dataset, index) => processDataset(dataset, index))

        myLineChart.current = new Chart(myChartRef, {
            type: type || 'line',
            data: {
                //Bring in data
                labels: labels,
                datasets: datasets,
            },
            options:
                type !== 'doughnut'
                    ? {
                          responsive: true,
                          maintainAspectRatio: false,
                          scaleShowHorizontalLines: false,
                          tooltips: {
                              yAlign: 'bottom',
                              enabled: true,
                              intersect: false,
                              mode: 'nearest',
                              bodySpacing: 5,
                              yPadding: 10,
                              xPadding: 10,
                              caretPadding: 0,
                              displayColors: false,
                              backgroundColor: '#1dc9b7',
                              titleFontColor: '#ffffff',
                              labelFontSize: 23,
                              cornerRadius: 4,
                              fontSize: 16,
                              footerSpacing: 0,
                              titleSpacing: 0,
                              callbacks: {
                                  label: function(tooltipItem, data) {
                                      let entityData = data.datasets[tooltipItem.datasetIndex]
                                      if (entityData.dotted && !(tooltipItem.index === entityData.data.length - 1))
                                          return null
                                      var label = entityData.chartLabel || entityData.label || ''
                                      if (
                                          entityData.action &&
                                          entityData.action.properties &&
                                          !_.isEmpty(entityData.action.properties)
                                      ) {
                                          label += ` (${entityData.action.properties
                                              .map(
                                                  property =>
                                                      operatorMap[property.operator || 'exact'].split(' ')[0] +
                                                      ' ' +
                                                      property.value
                                              )
                                              .join(', ')})`
                                      }

                                      return label + ' - ' + tooltipItem.yLabel.toLocaleString()
                                  },
                              },
                          },
                          hover: {
                              mode: 'nearest',
                              onHover(e) {
                                  if (_this.props.onClick) {
                                      const point = this.getElementAtEvent(e)
                                      if (point.length) e.target.style.cursor = 'pointer'
                                      else e.target.style.cursor = 'default'
                                  }
                              },
                          },
                          scales: {
                              xAxes: [
                                  {
                                      display: true,
                                      gridLines: { lineWidth: 0, color: axisLineColor, zeroLineColor: axisColor },
                                      ticks: {
                                          autoSkip: true,
                                          beginAtZero: true,
                                          min: 0,
                                          fontColor: axisLabelColor,
                                          precision: 0,
                                          padding: 40,
                                      },
                                  },
                              ],
                              yAxes: [
                                  {
                                      display: true,
                                      gridLines: { color: axisLineColor, zeroLineColor: axisColor },
                                      ticks: {
                                          autoSkip: true,
                                          beginAtZero: true,
                                          min: 0,
                                          fontColor: axisLabelColor,
                                          precision: 0,
                                      },
                                  },
                              ],
                          },
                          events: ['mousemove', 'click'],
                          onClick: (_, [point]) => {
                              if (point && onClick) {
                                  const dataset = datasets[point._datasetIndex]
                                  onClick({
                                      point,
                                      dataset,
                                      index: point._index,
                                      label:
                                          typeof point._index !== 'undefined' && dataset.labels
                                              ? dataset.labels[point._index]
                                              : undefined,
                                      day:
                                          typeof point._index !== 'undefined' && dataset.days
                                              ? dataset['compare']
                                                  ? dataset.dates[point._index]
                                                  : dataset.days[point._index]
                                              : undefined,
                                      value:
                                          typeof point._index !== 'undefined' && dataset.data
                                              ? dataset.data[point._index]
                                              : undefined,
                                  })
                              }
                          },
                          onHover: evt => {
                              if (focused) return
                              const leftExtent = myLineChart.current.scales['x-axis-0'].left
                              const rightExtent = myLineChart.current.scales['x-axis-0'].right
                              const ticks = myLineChart.current.scales['x-axis-0'].ticks.length
                              const delta = rightExtent - leftExtent
                              const interval = delta / (ticks - 1)
                              if (evt.offsetX < leftExtent - interval / 2) return
                              const index = map(
                                  evt.offsetX,
                                  leftExtent - interval / 2,
                                  rightExtent + interval / 2,
                                  0,
                                  ticks
                              )
                              if (index >= 0 && index < ticks) {
                                  setLeft(index * interval + leftExtent)
                                  setLabelIndex(index)
                              }
                          },
                      }
                    : {
                          responsive: true,
                          maintainAspectRatio: false,
                          hover: { mode: 'index' },
                      },
        })
    }

    return (
        <div className="graph-container" data-attr={dataAttr} onMouseLeave={() => setEnabled(false)}>
            <canvas
                ref={chartRef}
                onMouseOver={_ => {
                    if (!focused) {
                        setEnabled(true)
                        setLeft(-1)
                    }
                }}
            />
            {(enabled || focused) && left >= 0 && (
                <Popover
                    trigger="click"
                    defaultVisible={false}
                    content={
                        <div>
                            <span style={{ marginBottom: 12 }}>{selectedDayLabel}</span>
                            <TextArea
                                style={{ marginBottom: 12 }}
                                rows={4}
                                onChange={e => setTextInput(e.target.value)}
                            ></TextArea>
                            <Row justify="end">
                                <Button onClick={() => setFocused(false)}>Cancel</Button>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        setFocused(false)
                                        dashboardItemId
                                            ? createAnnotationNow(textInput, datasets[0].days[labelIndex])
                                            : createAnnotation(textInput, datasets[0].days[labelIndex])
                                    }}
                                >
                                    Add
                                </Button>
                            </Row>
                        </div>
                    }
                    title={'Add Annotation'}
                    visible={focused}
                >
                    <Button
                        style={{
                            position: 'absolute',
                            left: left - 15,
                            top: myLineChart.current.scales['x-axis-0'].top + 12,
                            width: 30,
                            height: 30,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        type="primary"
                        onClick={() => {
                            setFocused(true)
                            setSelectedDayLabel(datasets[0].labels[labelIndex])
                        }}
                    >
                        <PlusOutlined></PlusOutlined>
                    </Button>
                </Popover>
            )}
            <Annotations
                labeledDates={datasets[0].days}
                leftExtent={leftExtent}
                interval={interval}
                topExtent={topExtent}
                dashboardItemId={dashboardItemId}
            ></Annotations>
        </div>
    )
}

const Annotations = React.memo(function Annotations({
    labeledDates,
    leftExtent,
    interval,
    topExtent,
    dashboardItemId,
}) {
    const [groupedAnnotations, setGroupedAnnotations] = useState({})
    const [diffType, setDiffType] = useState(determineDifferenceType(labeledDates[0], labeledDates[1]))
    const { annotationsList } = useValues(annotationsModel({ pageKey: dashboardItemId ? dashboardItemId : null }))
    const { createAnnotation, createAnnotationNow } = useActions(
        annotationsModel({ pageKey: dashboardItemId ? dashboardItemId : null })
    )
    const [textInput, setTextInput] = useState('')
    const {
        user: { name, email },
    } = useValues(userLogic)

    useEffect(() => {
        // calculate groups
        setDiffType(determineDifferenceType(labeledDates[0], labeledDates[1]))
        let groupedResults = _.groupBy(annotationsList, annote => moment(annote['date_marker']).startOf(diffType))
        setGroupedAnnotations(groupedResults)
    }, [annotationsList, labeledDates])

    const markers = []
    labeledDates.forEach((date, index) => {
        if (groupedAnnotations[moment(date).startOf(diffType)]) {
            markers.push(
                <Popover
                    key={index}
                    trigger="click"
                    defaultVisible={false}
                    content={
                        <div style={{ minWidth: 300 }}>
                            {groupedAnnotations[moment(date).startOf(diffType)].map(data => (
                                <div key={data.id} style={{ marginBottom: 25 }}>
                                    <Row justify="space-between">
                                        <b>
                                            {(data.created_by &&
                                                (data.created_by.first_name || data.created_by.email)) ||
                                                name ||
                                                email}
                                        </b>
                                        <span>{humanFriendlyDetailedTime(data.created_at)}</span>
                                    </Row>
                                    <span>{data.content}</span>
                                </div>
                            ))}
                            <TextArea
                                style={{ marginBottom: 12 }}
                                rows={4}
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                            ></TextArea>
                            <Row justify="end">
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        dashboardItemId
                                            ? createAnnotationNow(textInput, labeledDates[index])
                                            : createAnnotation(textInput, labeledDates[index])
                                        setTextInput('')
                                    }}
                                >
                                    Add
                                </Button>
                            </Row>
                        </div>
                    }
                    title={'Annotation'}
                >
                    <Button
                        style={{
                            position: 'absolute',
                            left: index * interval + leftExtent - 15,
                            top: topExtent,
                            width: 30,
                            height: 30,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        type="primary"
                    >
                        <span>{groupedAnnotations[moment(date).startOf(diffType)].length}</span>
                    </Button>
                </Popover>
            )
        }
    })
    return markers
})

function determineDifferenceType(firstDate, secondDate) {
    const first = moment(firstDate)
    const second = moment(secondDate)
    if (first.diff(second, 'years') !== 0) return 'year'
    else if (first.diff(second, 'months') !== 0) return 'month'
    else if (first.diff(second, 'weeks') !== 0) return 'week'
    else if (first.diff(second, 'days') !== 0) return 'day'
    else if (first.diff(second, 'hours') !== 0) return 'hour'
    else return 'minute'
}

const map = (value, x1, y1, x2, y2) => Math.floor(((value - x1) * (y2 - x2)) / (y1 - x1) + x2)

LineGraph.propTypes = {
    datasets: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, count: PropTypes.number })).isRequired,
    labels: PropTypes.array.isRequired,
    options: PropTypes.object,
    type: PropTypes.string,
    onClick: PropTypes.func,
}
