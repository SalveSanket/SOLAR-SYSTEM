pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
    }

    tools {
        nodejs 'nodejs-22-6-0'
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            parallel {
                stage('NPM Dependency Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                        echo '🔍 Audit completed successfully!'
                    }
                }

                stage('OWASP Dependency Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'

                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --data /var/lib/jenkins/owasp-data
                        ''', odcInstallation: 'OWASP-DepCheck'

                        dependencyCheckPublisher thresholdLimit: 'critical', failedTotalCritical: 1, unstableTotalHigh: 10, unstableTotalMedium: 10, pattern: 'dependency-check-report.xml'

                        echo '🧪 Publishing JUnit results...'
                        junit allowEmptyResults: true, testResults: 'dependency-check-junit.xml'

                        echo '📦 Archiving HTML report...'
                        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'dependency-check-jenkins.html', reportName: 'dependency-check-HTML Report', reportTitles: '', useWrapperFileDirectly: true])
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Build completed successfully!'
        }
        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}