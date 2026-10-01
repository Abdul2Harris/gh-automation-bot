"use client";

import { Empty, Table, Tag } from "antd";

export type RepositoryRow = {
  id: string;
  fullName: string;
  accountLogin: string;
  isPrivate: boolean;
};

export function RepositoryTable({ repositories }: { repositories: RepositoryRow[] }) {
  if (repositories.length === 0) {
    return <Empty description="No repositories connected" />;
  }

  return (
    <Table
      rowKey="id"
      pagination={false}
      dataSource={repositories}
      columns={[
        {
          title: "Repository",
          dataIndex: "fullName",
          key: "fullName",
        },
        {
          title: "Account",
          dataIndex: "accountLogin",
          key: "accountLogin",
        },
        {
          title: "Visibility",
          dataIndex: "isPrivate",
          key: "isPrivate",
          render: (isPrivate: boolean) => (
            <Tag color={isPrivate ? "gold" : "green"}>
              {isPrivate ? "Private" : "Public"}
            </Tag>
          ),
        },
      ]}
    />
  );
}
