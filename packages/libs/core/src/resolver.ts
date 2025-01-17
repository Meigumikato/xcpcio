import _ from "lodash";

import { Rank } from "./rank";
import type { Contest } from "./contest";
import type { Teams } from "./team";
import { Team } from "./team";
import type { Submissions } from "./submission";
import { Submission } from "./submission";
import type { TeamProblemStatistics } from "./problem";
import { ResolverOperation } from "./resolver-operation";

export class Resolver extends Rank {
  finalRank: Rank;
  operations: Array<ResolverOperation>;

  beforeFreezeSubmissions: Submissions;
  afterFreezeSubmissions: Submissions;

  constructor(contest: Contest, teams: Teams, submissions: Submissions) {
    submissions.sort(Submission.compare);

    let beforeFreezeSubmissions = submissions;
    let afterFreezeSubmissions = submissions;

    {
      const ix = _.sortedIndex(
        submissions.map(s => s.timestamp),
        contest.unFreezeDurationTimestamp,
      );

      beforeFreezeSubmissions = submissions.slice(0, ix + 1);
      afterFreezeSubmissions = submissions.slice(ix, -1);
    }

    super(contest, teams, beforeFreezeSubmissions);

    this.finalRank = new Rank(contest, teams, submissions);
    this.operations = [];

    this.beforeFreezeSubmissions = beforeFreezeSubmissions;
    this.afterFreezeSubmissions = afterFreezeSubmissions;
  }

  buildResolver() {
    this.buildRank();
    this.finalRank.buildRank();

    for (const s of this.afterFreezeSubmissions) {
      const teamId = s.teamId;
      const problemId = s.problemId;
      const team = this.teamsMap.get(teamId);
      const problem = this.contest.problemsMap.get(problemId);

      if (team === undefined || problem === undefined) {
        continue;
      }

      const problemStatistics = team.problemStatisticsMap.get(problemId) as TeamProblemStatistics;

      problemStatistics.pendingCount++;
      problemStatistics.totalCount++;
      if (!problemStatistics.isAccepted) {
        problemStatistics.lastSubmitTimestamp = s.timestamp;
      }
    }

    {
      const teams_ = _.cloneDeep(this.teams);

      for (let i = this.teams.length - 1; i >= 0;) {
        const team = teams_[i];
        const teamId = team.id;

        let handleCnt = 0;
        let problemIx = -1;
        for (const p of team.problemStatistics) {
          problemIx++;

          if (!p.isPending) {
            continue;
          }

          handleCnt++;

          const beforeTeamProblemStatistics = this.teamsMap.get(teamId)?.problemStatistics[
            problemIx
          ] as TeamProblemStatistics;
          const afterTeamProblemStatistics = this.finalRank.teamsMap.get(teamId)?.problemStatistics[
            problemIx
          ] as TeamProblemStatistics;

          const op = new ResolverOperation();
          op.id = this.operations.length;
          op.team = this.teamsMap.get(teamId) as Team;
          op.problemIx = problemIx;

          op.beforeTeamProblemStatistics = beforeTeamProblemStatistics;
          op.afterTeamProblemStatistics = afterTeamProblemStatistics;

          this.operations.push(op);

          team.problemStatistics[problemIx] = afterTeamProblemStatistics;
          team.calcSolvedData();

          break;
        }

        {
          let j = i;
          while (j > 0 && Team.compare(teams_[j], teams_[j - 1]) < 0) {
            [teams_[j], teams_[j - 1]] = [teams_[j - 1], teams_[j]];
            j--;
          }
        }

        if (handleCnt === 0) {
          i--;
        }
      }
    }
  }
}
