import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import Loading from '@/components/Loading/Loading';

function getChartObj(
    title: string,
    xText: string,
    yText: string,
    cat: any,
    data: any,
) {
    return {
        colors: ['rgb(124, 181, 236)'],
        chart:
            window.innerWidth < 992
                ? {
                      type: 'bar',
                      backgroundColor: 'transparent',
                  }
                : {
                      type: 'column',
                      backgroundColor: 'transparent',
                      height: '350px',
                  },
        title: {
            text: title,
        },
        xAxis: {
            categories: cat,
            labels: {
                style: {
                    fontSize: '16px',
                },
            },
            title: {
                text: xText,
                style: {
                    fontSize: '16px',
                },
            },
        },
        yAxis: {
            min: 0,
            title: {
                text: yText,
                style: {
                    fontSize: '16px',
                    height: '320px',
                },
            },
            stackLabels: {
                enabled: true,
                style: {
                    fontSize: '16px',
                },
            },
        },
        tooltip: {
            enabled: true,
            headerFormat: '',
            pointFormat: '{series.name}：{point.y}',
        },
        plotOptions: {
            bar: {
                stacking: 'normal',
            },
            column: {
                stacking: 'normal',
            },
        },
        credits: {
            enabled: false,
        },
        series: [
            {
                name: '队伍数',
                showInLegend: false,
                data: data,
            },
        ],
    };
}

function getProblemChart(contest_config: any, team: any, run: any) {
    let problem_list: any = [];
    contest_config.problem_id.forEach((problem_id: any, index: number) => {
        let item: any = {};
        item['problem_id'] = problem_id;
        item['index'] = index;
        item['solved'] = 0;
        problem_list.push(item);
    });
    let dic: any = {};
    run.forEach((run: any) => {
        if (run.status === 'correct') {
            const id = [run.team_id, run.problem_id].join('-');
            if (!(dic[id] === 1)) {
                dic[id] = 1;
                problem_list[run.problem_id].solved += 1;
            }
        }
    });
    problem_list.sort((a: any, b: any) => {
        if (a.solved > b.solved) return -1;
        if (a.solved < b.solved) return 1;
        if (a.index < b.index) return -1;
        if (a.index > b.index) return 1;
        return 0;
    });
    let cat: any = [];
    let data: any = [];
    problem_list.forEach((problem: any) => {
        cat.push(problem.problem_id);
        data.push(problem.solved);
    });
    return getChartObj('题目通过数统计', '题目编号', '通过数', cat, data);
}

function getTeamChart(contest_config: any, team: any, run: any) {
    let team_list: any = {};
    for (let team_id in team) {
        let item = team[team_id];
        team_list[team_id] = {};
        let new_item = team_list[team_id];
        new_item.solved = 0;
    }
    let dic: any = {};
    run.forEach((run: any) => {
        const id = [run.team_id, run.problem_id].join('-');
        if (!(dic[id] === 1)) {
            dic[id] = 1;
            team_list[run.team_id].solved += 1;
        }
    });
    let len = contest_config.problem_id.length;
    let num: any = [];
    for (let i = 0; i <= len; ++i) {
        num[i] = {
            index: i,
            cnt: 0,
        };
    }
    for (let k in team_list) {
        num[team_list[k].solved].cnt += 1;
    }
    let cat: any = [];
    let data: any = [];
    num.forEach((num: any) => {
        cat.push(num.index);
        data.push(num.cnt);
    });
    return getChartObj('队伍过题数统计', '过题数', '队伍数', cat, data);
}

class Statistics extends React.Component {
    contest_config: any = {};
    team: any = {};
    run: any = [];

    update(props: any) {
        this.contest_config = props.contest_config;
        this.team = props.team;
        this.run = props.run;
        this.setState({
            problemChartOptions: getProblemChart(
                this.contest_config,
                this.team,
                this.run,
            ),
            teamChartOptions: getTeamChart(
                this.contest_config,
                this.team,
                this.run,
            ),
            loaded: true,
        });
    }

    //在组件已经被渲染到 DOM 中后运行
    async componentDidMount() {}

    //props中的值发生改变时执行
    async componentWillReceiveProps(nextProps: any) {
        this.update(nextProps);
    }

    state = {
        loaded: false,
        problemChartOptions: {},
        teamChartOptions: {},
    };

    constructor(props: any) {
        super(props);
        setTimeout(() => {
            this.update(this.props);
        }, 500);
    }

    render() {
        return (
            <>
                {this.state.loaded === false && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 'calc(80vh)',
                        }}
                    >
                        <Loading />
                    </div>
                )}

                {this.state.loaded === true && (
                    <>
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={this.state.problemChartOptions}
                        />
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={this.state.teamChartOptions}
                        />
                    </>
                )}
            </>
        );
    }
}

export default Statistics;