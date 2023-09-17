import _ from "lodash";

import type { Contest } from "./contest";
import type { Teams } from "./team";
import { Team } from "./team";
import type { Submissions } from "./submission";
import { Submission } from "./submission";
import { TeamProblemStatistics } from "./problem";
import { RankStatistics } from "./rank-statistics";

export class RankOptions {
  enableFilterSubmissionsByTimestamp: boolean;
  width: number;
  timestamp: number;

  enableFilterTeamsByGroup: boolean;
  group: string;

  constructor() {
    this.enableFilterSubmissionsByTimestamp = false;
    this.width = 0;
    this.timestamp = 0;

    this.enableFilterTeamsByGroup = false;
    this.group = "";
  }

  setWidth(width: number, contest: Contest) {
    this.width = width;
    this.timestamp = Math.floor((contest.endTime.unix() - contest.startTime.unix()) * this.width * 0.0001);
    this.enableFilterSubmissionsByTimestamp = true;
  }

  disableFilterSubmissionByTimestamp() {
    this.enableFilterSubmissionsByTimestamp = false;
  }

  setGroup(group: string) {
    this.group = group;
    this.enableFilterTeamsByGroup = true;

    if (this.group === "all") {
      this.disableFilterTeamsByGroup();
    }
  }

  disableFilterTeamsByGroup() {
    this.enableFilterTeamsByGroup = false;
  }
}

export class Rank {
  readonly contest: Contest;

  teams: Teams;
  teamsMap: Map<string, Team>;

  submissions: Submissions;
  submissionsMap: Map<string, Submission>;

  rankStatistics: RankStatistics;

  options: RankOptions;

  constructor(contest: Contest, teams: Teams, submissions: Submissions) {
    this.contest = contest;

    this.teams = _.cloneDeep(teams);
    this.teamsMap = new Map(this.teams.map(t => [t.id, t]));

    this.submissions = _.cloneDeep(submissions).sort(Submission.compare);
    this.submissionsMap = new Map(this.submissions.map(s => [s.id, s]));

    this.rankStatistics = new RankStatistics();

    this.options = new RankOptions();
  }

  buildRank() {
    (() => {
      (() => {
        this.teams = [];

        for (const [_k, v] of this.teamsMap) {
          if (this.filterTeamByOrg(v)) {
            continue;
          }

          this.teams.push(v);
        }
      })();

      for (const t of this.teams) {
        t.reset();

        t.problemStatistics = this.contest.problems.map((p) => {
          const ps = new TeamProblemStatistics();
          ps.problem = p;
          ps.contestPenalty = this.contest.penalty;

          return ps;
        });

        t.problemStatisticsMap = new Map(t.problemStatistics.map(ps => [ps.problem.id, ps]));
      }

      this.contest.problems.forEach((p) => {
        p.statistics.reset();
      });

      let preSubmissionTimestampToMinute = 0;
      const allSubmissions = this.getSubmissions();

      this.teams.forEach(t =>
        t.placeChartPoints.push({
          timePoint: 0,
          rank: 1,
          lastSolvedProblem: null,
        }),
      );

      for (let ix = 0; ix < allSubmissions.length; ix++) {
        const s = allSubmissions[ix];

        const teamId = s.teamId;
        const problemId = s.problemId;
        const team = this.teamsMap.get(teamId);
        const problem = this.contest.problemsMap.get(problemId);

        (() => {
          if (team === undefined || this.filterTeamByOrg(team) || problem === undefined) {
            return;
          }

          const problemStatistics = team.problemStatisticsMap.get(problemId) as TeamProblemStatistics;
          const submissions = problemStatistics.submissions;

          submissions.push(s);
          team.submissions.push(s);
          problem.statistics.submittedNum++;

          if (problemStatistics.isSolved) {
            return;
          }

          if (s.isIgnore || s.isNotCalculatedPenaltyStatus()) {
            problem.statistics.ignoreNum++;
            problemStatistics.ignoreCount++;
            return;
          }

          problemStatistics.isSubmitted = true;
          problemStatistics.lastSubmitTimestamp = s.timestamp;
          problemStatistics.totalCount++;

          if (s.isAccepted()) {
            problemStatistics.isSolved = true;
            problemStatistics.solvedTimestamp = s.timestamp;

            problem.statistics.acceptedNum++;
            problem.statistics.attemptedNum += problemStatistics.failedCount + 1;

            if (
              problem.statistics.firstSolveSubmissions.length === 0
              || problem.statistics.firstSolveSubmissions[problem.statistics.firstSolveSubmissions.length - 1].timestamp === s.timestamp
            ) {
              problemStatistics.isFirstSolved = true;
              problem.statistics.firstSolveSubmissions.push(s);
            }

            while (problem.statistics.lastSolveSubmissions.length > 0) {
              problem.statistics.lastSolveSubmissions.pop();
            }

            problem.statistics.lastSolveSubmissions.push(s);

            team.lastSolvedProblem = problem;
            team.lastSolvedProblemTimestamp = s.timestamp;
          }

          if (s.isRejected()) {
            problemStatistics.failedCount++;
            problem.statistics.rejectedNum++;
          }

          if (s.isPending()) {
            problemStatistics.pendingCount++;
            problem.statistics.pendingNum++;
          }
        })();

        if (s.timestampToMinute > preSubmissionTimestampToMinute || ix === allSubmissions.length - 1) {
          this.teams.forEach(t => t.calcSolvedData());
          this.teams.sort(Team.compare);
          this.buildTeamRank();

          this.teams.forEach(t =>
            t.placeChartPoints.push(
              {
                timePoint: s.timestampToMinute,
                rank: t.rank,
                lastSolvedProblem: t.lastSolvedProblem,
              },
            ),
          );
        }

        preSubmissionTimestampToMinute = s.timestampToMinute;
      }

      this.teams.forEach(t => t.postProcessPlaceChartPoints());
      this.buildTeamRank();
      this.buildOrgRank();
    })();

    (() => {
      this.rankStatistics.reset();

      this.rankStatistics.teamSolvedNum = Array(this.contest.problems.length + 1).fill(0);
      for (const t of this.teams) {
        this.rankStatistics.teamSolvedNum[t.solvedProblemNum]++;
      }
    })();

    return this;
  }

  buildTeamRank() {
    let rank = 1;
    let originalRank = 1;
    let preTeam = null;
    for (const t of this.teams) {
      t.rank = rank++;
      t.originalRank = originalRank++;

      if (preTeam !== null) {
        if (t.isEqualRank(preTeam)) {
          t.rank = preTeam.rank;
        }
      }

      preTeam = t;
    }
  }

  buildOrgRank() {
    if (!this.contest.organization) {
      return;
    }

    let rank = 1;
    let preTeam = null;

    const se = new Set<string>();

    for (const t of this.teams) {
      const org = t.organization;
      if (se.has(org)) {
        continue;
      }

      se.add(org);
      t.organizationRank = rank++;

      if (preTeam !== null) {
        if (t.isEqualRank(preTeam)) {
          t.organizationRank = preTeam.organizationRank;
        }
      }

      preTeam = t;
    }
  }

  filterTeamByOrg(team: Team) {
    const o = this.options;

    if (o.enableFilterTeamsByGroup) {
      if (!team.group?.includes(o.group)) {
        return true;
      }
    }

    return false;
  }

  getSubmissions() {
    if (this.options.enableFilterSubmissionsByTimestamp === false) {
      return this.submissions;
    }

    return this.submissions.filter(s => s.timestamp <= this.options.timestamp).sort(Submission.compare);
  }
}
